FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

ENV MODELS_DIR=/mnt/models
RUN mkdir -p $MODELS_DIR
VOLUME ["/mnt/models"]

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
