module.exports = {
  apps: [{
    name: 'deploy-agent',
    script: 'scripts/deploy-agent.mjs',
    cwd: __dirname,
    env: {
      DEPLOY_AGENT_PORT: '18903',
      DEPLOY_AGENT_HOST: '0.0.0.0',
      DEPLOY_AGENT_SECRET: require('fs').readFileSync(require('path').join(__dirname, '.deploy-agent.secret'), 'utf-8').trim(),
      PM2_HOME: require('path').join(__dirname, '.pm2'),
    },
    log_file: 'logs/deploy-agent.log',
    error_file: 'logs/deploy-agent-error.log',
    out_file: 'logs/deploy-agent-out.log',
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 5000,
  }]
};