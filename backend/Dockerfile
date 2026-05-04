# =============================================================================
# CondoManager Pro — Backend Lambda Container Image
# Base: AWS Lambda Python 3.10 runtime
# =============================================================================

FROM public.ecr.aws/lambda/python:3.10

# Install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy application code
COPY lambda_function.py ${LAMBDA_TASK_ROOT}/

# Lambda handler entrypoint
CMD ["lambda_function.lambda_handler"]
