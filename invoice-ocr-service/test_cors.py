import os
from dotenv import load_dotenv

# 打印当前工作目录
print('Current working directory:', os.getcwd())

# 检查.env文件是否存在
print('Env file exists:', os.path.exists('.env'))

# 如果存在，打印内容
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        print('Env file content:', f.read())

# 加载环境变量
load_dotenv()

# 打印CORS_ORIGINS
print('Loaded CORS_ORIGINS:', os.getenv('CORS_ORIGINS'))
print('Type of CORS_ORIGINS:', type(os.getenv('CORS_ORIGINS')))
print('Raw value:', repr(os.getenv('CORS_ORIGINS')))

# 测试_cors_allow_origins函数
raw = (os.getenv("CORS_ORIGINS") or "*").strip()
if not raw or raw == "*":
    print('Result 1:', ["*"])
else:
    origins = [x.strip() for x in raw.split(",") if x.strip()]
    non_wild = [o for o in origins if o != "*"]
    print('Result 2:', non_wild if non_wild else ["*"])