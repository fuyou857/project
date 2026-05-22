# 合同转换服务 · 构建说明
# - 推荐在项目根执行：docker compose build contract-convert（compose 已设 context: ./contract-convert-service）
# - 若手写 docker build：docker build -f contract-convert-service/Dockerfile -t contract-convert:test contract-convert-service
#   最后一个参数必须是本目录（含 requirements.txt 与 app/），不要用仓库根当 context。
# 默认走 docker.io；国内若 metadata 超时，在 docker-compose / .env 中设置
# CONTRACT_CONVERT_BASE_IMAGE，例如 docker.m.daocloud.io/library/python:3.11-slim-bookworm
ARG BASE_IMAGE=docker.io/library/python:3.11-slim-bookworm
FROM ${BASE_IMAGE}

# Debian 源主机（国内构建可在 compose / .env 里设 DEBIAN_APT_HOST，如 mirrors.tuna.tsinghua.edu.cn）
ARG DEBIAN_APT_HOST=mirrors.aliyun.com

# 国内直连 deb.debian.org 常极慢；换源 + 强制 IPv4（双栈下偶发长时间卡住）+ 非交互安装
RUN set -eux; \
  export DEBIAN_FRONTEND=noninteractive; \
  printf '%s\n' \
    'Acquire::ForceIPv4 "true";' \
    'Acquire::http::Timeout "120";' \
    'Acquire::https::Timeout "120";' \
    > /etc/apt/apt.conf.d/99ciond-apt; \
  echo "==> patch apt sources -> ${DEBIAN_APT_HOST}"; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i "s/deb.debian.org/${DEBIAN_APT_HOST}/g; s/security.debian.org/${DEBIAN_APT_HOST}/g" \
      /etc/apt/sources.list.d/debian.sources; \
  elif [ -f /etc/apt/sources.list ]; then \
    sed -i "s/deb.debian.org/${DEBIAN_APT_HOST}/g; s/security.debian.org/${DEBIAN_APT_HOST}/g" \
      /etc/apt/sources.list; \
  fi; \
  echo "==> apt-get update"; \
  apt-get update; \
  echo "==> apt-get install libreoffice (体积大，数分钟属正常，请耐心等)"; \
  apt-get install -y --no-install-recommends \
    libreoffice-writer-nogui \
    fonts-noto-cjk \
    fontconfig; \
  echo "==> apt done"; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# requirements 已锁到有 cp311 manylinux wheel 的版本，一般无需 gcc；若日后某包回落到 sdist，再在本层加 build-essential
RUN pip install --no-cache-dir \
  -i https://mirrors.aliyun.com/pypi/simple/ \
  --trusted-host mirrors.aliyun.com \
  -r requirements.txt
COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8788
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8788"]
