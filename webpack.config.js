const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CSSMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isDev = argv.mode !== 'production';
  const isAnalyze = argv.analyze || false;
  /** 低配 VPS：CIOND_LOW_MEM_BUILD=1 时跳过 gzip/brotli 二次压缩，显著降低峰值内存 */
  const lowMemBuild = !isDev && process.env.CIOND_LOW_MEM_BUILD === '1';

  class EmitPwaAssetsPlugin {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('EmitPwaAssetsPlugin', compilation => {
        compilation.hooks.processAssets.tap(
          {
            name: 'EmitPwaAssetsPlugin',
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            const manifest = {
              name: '建筑工程企业内部管理系统',
              short_name: '工程管理',
              start_url: './',
              scope: './',
              display: 'standalone',
              background_color: '#1e3a8a',
              theme_color: '#1e3a8a',
              lang: 'zh-CN',
              icons: [],
            };
            const swSource = `'use strict';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
`;
            compilation.emitAsset(
              'manifest.json',
              new webpack.sources.RawSource(JSON.stringify(manifest))
            );
            compilation.emitAsset('sw.js', new webpack.sources.RawSource(swSource));
          }
        );
      });
    }
  }

  // 读取 .env 文件
  let envVars = {};
  try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key) envVars[key] = value;
    });
  } catch (e) {
    console.log('.env file not found');
  }

  // 仅注入浏览器可公开的环境变量，避免将服务端密钥打进 bundle（尤其是 SUPABASE_SERVICE_ROLE_KEY）
  const CLIENT_SAFE_ENV_KEYS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    // 可选：Edge Functions 根 URL（如 https://业务域/supabase/functions/v1），用于反代绕过浏览器直连失败
    'SUPABASE_FUNCTIONS_URL',
    // 企业微信登录页前端读取（与自建 /api 回调 URL 配套）
    'WECHAT_WORK_CORP_ID',
    'WECHAT_WORK_AGENT_ID',
    'WECHAT_WORK_REDIRECT_URI',
    /** ONLYOFFICE 文档服务器根 URL（如 https://office.example.com），供合同预览嵌入 api.js */
    'ONLYOFFICE_DOCUMENT_SERVER_URL',
    /** 可选：保存回调完整 URL；未配置时编辑器以只读模式打开，避免回调 500 阻塞加载 */
    'ONLYOFFICE_CALLBACK_URL',
    /** 可选：本地 PaddleOCR 发票服务根 URL（如 https://ocr.example.com），见 invoice-ocr-service/README.md */
    'INVOICE_OCR_SERVICE_URL',
    /** 与上一项二选一；部分团队习惯用 NEXT_PUBLIC_ 前缀（本仓库为 Webpack，非 Next.js，仍须在此列出才会注入 bundle） */
    'NEXT_PUBLIC_INVOICE_OCR_SERVICE_URL',
  ];
  const publicEnvVars = {
    NODE_ENV: isDev ? 'development' : 'production',
  };
  for (const key of CLIENT_SAFE_ENV_KEYS) {
    if (envVars[key]) {
      publicEnvVars[key] = envVars[key];
    }
  }

  /** 构建时写入 template.html，供 OnlyOfficeEditor 在 window 上读取（避免仅依赖 chunk 内 process.env） */
  const onlyofficeDocUrl = String(envVars.ONLYOFFICE_DOCUMENT_SERVER_URL || '').trim();
  const onlyofficeCbUrl = String(envVars.ONLYOFFICE_CALLBACK_URL || '').trim();
  const invoiceOcrServiceUrl = String(
    envVars.INVOICE_OCR_SERVICE_URL || envVars.NEXT_PUBLIC_INVOICE_OCR_SERVICE_URL || '',
  ).trim();

  const config = {
    mode: isDev ? 'development' : 'production',
    entry: {
      main: './src/index.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].bundle.js' : '[name].[contenthash:16].js',
      chunkFilename: isDev ? '[name].chunk.js' : '[name].[contenthash:16].chunk.js',
      publicPath: '/',
      clean: {
        keep: /\.user\.ini/,
      },
      assetModuleFilename: 'assets/[name].[contenthash:16][ext][query]',
    },
    optimization: {
      minimize: isDev ? false : !lowMemBuild,
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: lowMemBuild
        ? false
        : {
            chunks: 'all',
            cacheGroups: {
              recharts: {
                test: /[\\/]node_modules[\\/]recharts[\\/]/,
                name: 'recharts',
                chunks: 'all',
                priority: 20,
              },
              tiptap: {
                test: /[\\/]node_modules[\\/]@tiptap[\\/]/,
                name: 'tiptap',
                chunks: 'all',
                priority: 20,
              },
              docOffice: {
                test: /[\\/]node_modules[\\/](docx|mammoth|xlsx|docx-preview)[\\/]/,
                name: 'doc-office',
                chunks: 'all',
                priority: 15,
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: -10,
              },
              common: {
                name: 'common',
                chunks: 'all',
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
              },
            },
          },
      minimizer: lowMemBuild
        ? []
        : [
            new TerserPlugin({
              // 低配 VPS 上 parallel 默认 true 易触发 OOM(137)；单线程更稳、稍慢
              parallel: false,
              terserOptions: {
                compress: {
                  // 勿使用 drop_console：会删掉 console.error，线上 F12 一片空白，无法排错
                  pure_funcs: !isDev
                    ? ['console.log', 'console.info', 'console.debug', 'console.trace']
                    : [],
                  drop_debugger: !isDev,
                  // 禁用可能导致 Hooks 调用顺序问题的优化
                  collapse_vars: false,
                  reduce_vars: false,
                  hoist_vars: false,
                  hoist_funs: false,
                },
                output: {
                  comments: false,
                  beautify: isDev,
                },
                // 禁用可能影响 React Hooks 的优化
                mangle: {
                  keep_classnames: true,
                  keep_fnames: true,
                },
              },
              extractComments: false,
            }),
            new CSSMinimizerPlugin({
              parallel: false,
            }),
          ],
    },
    module: {
      rules: [
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto',
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-react',
                  {
                    runtime: 'automatic',
                    development: isDev,
                  },
                ],
                [
                  '@babel/preset-env',
                  {
                    targets: {
                      browsers: ['> 1%', 'last 2 versions', 'not dead'],
                    },
                    useBuiltIns: 'usage',
                    corejs: 3,
                  },
                ],
                '@babel/preset-typescript',
              ],
              plugins: [],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                modules: false,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.(png|jpe?g|gif|webp|ico)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024,
            },
          },
        },
        {
          test: /\.svg$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024,
            },
          },
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024,
            },
          },
        },
      ],
    },
    resolve: {
      extensions: ['.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    devServer: {
      port: 3015,
      allowedHosts: 'all',
      historyApiFallback: {
        index: '/index.html',
        rewrites: [
          { from: /^\/_p\/\d+\//, to: '/index.html' }
        ]
      },
      hot: true,
      compress: true,
      client: {
        overlay: true,
      },
      proxy: {
        '/api/invoice/ocr': {
          target: 'http://localhost:8810',
          changeOrigin: true,
          secure: false,
        },
        '/api/invoice/upload-ofd': {
          target: 'http://localhost:8810',
          changeOrigin: true,
          secure: false,
        },
        '/api/common/logs': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    cache: isDev
      ? {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
        }
      : false,
    performance: {
      hints: isDev ? false : 'warning',
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './template.html',
        inject: 'body',
        templateParameters: {
          onlyofficeDocumentServerUrlJson: onlyofficeDocUrl ? JSON.stringify(onlyofficeDocUrl) : '',
          onlyofficeCallbackUrlJson: onlyofficeCbUrl ? JSON.stringify(onlyofficeCbUrl) : '',
          invoiceOcrServiceUrlJson: invoiceOcrServiceUrl ? JSON.stringify(invoiceOcrServiceUrl) : '',
        },
        minify: !isDev ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(publicEnvVars),
      }),
      new webpack.ProvidePlugin({
        React: 'react',
      }),
      !isDev && new MiniCssExtractPlugin({
        filename: '[name].[contenthash:16].css',
        chunkFilename: '[name].[contenthash:16].chunk.css',
      }),
      !isDev && !lowMemBuild && new CompressionPlugin({
        algorithm: 'gzip',
        threshold: 8192,
        minRatio: 0.8,
      }),
      !isDev && !lowMemBuild && new CompressionPlugin({
        algorithm: 'brotliCompress',
        threshold: 8192,
        minRatio: 0.8,
      }),
      isAnalyze && new BundleAnalyzerPlugin(),
      !isDev && new EmitPwaAssetsPlugin(),
    ].filter(Boolean),
  };

  return config;
};