# Python Scripts 설정 가이드

## 초기 설정

프로젝트의 모든 스크립트를 프로젝트 루트(`C:\stockplatform\` 또는 `/home/user/stockplatform/`)에서 실행할 수 있도록 설정하는 방법입니다.

### 1. 개발 모드로 패키지 설치

프로젝트 루트 디렉토리에서 다음 명령어를 실행하세요:

```bash
pip install -e .
```

이 명령어는:
- `pyproject.toml` 파일을 기반으로 프로젝트를 설치합니다
- `-e` 플래그는 "editable" 모드로 설치하여, 코드 변경사항이 즉시 반영됩니다
- `scripts` 패키지를 Python 경로에 추가합니다

### 2. 스크립트 실행

설치 후에는 프로젝트 루트에서 모든 스크립트를 실행할 수 있습니다:

**Windows:**
```cmd
python scripts\example_industry_classifier.py
python scripts\fetch_krx_stocks.py
python scripts\update_indices.py
```

**Linux/Mac:**
```bash
python scripts/example_industry_classifier.py
python scripts/fetch_krx_stocks.py
python scripts/update_indices.py
```

### 3. 환경변수 설정

일부 스크립트는 환경변수가 필요합니다. `.env` 파일을 프로젝트 루트에 생성하세요:

```bash
# .env 파일 예시
DART_API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
```

## 의존성 관리

### 필수 패키지 설치

```bash
pip install -e .
```

이 명령어는 `pyproject.toml`에 정의된 모든 의존성을 자동으로 설치합니다:
- python-dotenv
- requests
- pandas
- openpyxl

### 개발 도구 설치 (선택사항)

```bash
pip install -e ".[dev]"
```

## 문제 해결

### ImportError: cannot import name 'XXX'

- `pip install -e .` 명령어를 실행했는지 확인하세요
- 패키지가 올바르게 설치되었는지 확인: `pip list | grep stockplatform`

### ModuleNotFoundError: No module named 'scripts'

- 프로젝트 루트 디렉토리에서 스크립트를 실행하고 있는지 확인하세요
- `pwd` (Linux/Mac) 또는 `cd` (Windows) 명령어로 현재 디렉토리 확인

### 패키지 재설치가 필요한 경우

```bash
pip uninstall stockplatform
pip install -e .
```

## 프로젝트 구조

```
stockplatform/
├── pyproject.toml          # 프로젝트 설정 및 의존성
├── .env                    # 환경변수 (git에 포함되지 않음)
├── scripts/                # 모든 스크립트
│   ├── __init__.py        # scripts 패키지 초기화
│   ├── industry_classifier/
│   │   ├── __init__.py
│   │   ├── pipeline.py
│   │   └── ...
│   ├── example_industry_classifier.py
│   └── ...
└── README.md
```

## 스크립트 작성 가이드

새로운 스크립트를 작성할 때는 다음과 같이 import 경로를 설정하세요:

```python
# scripts/my_new_script.py

# 같은 scripts 디렉토리의 모듈 import
from scripts.industry_classifier import IndustryClassifier
from scripts.other_module import some_function

# 외부 패키지 import
import pandas as pd
from dotenv import load_dotenv
```

이렇게 하면 프로젝트 루트에서 스크립트를 실행할 수 있습니다:

```bash
python scripts/my_new_script.py
```

## Windows 사용자 추가 안내

Windows에서 가상환경을 사용하는 경우:

```cmd
# 가상환경 활성화 (PowerShell)
.\venv\Scripts\Activate.ps1

# 가상환경 활성화 (CMD)
venv\Scripts\activate.bat

# 패키지 설치
pip install -e .

# 스크립트 실행
python scripts\example_industry_classifier.py
```
