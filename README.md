# Serverless Login with JWT and DynamoDB

This is a serverless application using AWS Lambda, API Gateway, and DynamoDB for user authentication with JWT.

## Prerequisites

- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed (download from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- Python 3.9+ for local testing
- AWS Secrets Manager configured (see secrets-setup.md)

## Deployment

1. **Configure AWS Secrets Manager**:
   Follow the instructions in `secrets-setup.md` to create the JWT secret.

2. Install dependencies (for local testing):
   ```
   pip install -r requirements.txt
   ```

3. Build and deploy with SAM:
   ```
   sam build
   sam deploy --guided
   ```

   During deployment, the Lambda function will automatically retrieve the JWT secret from Secrets Manager.

## Testing

### Local Frontend Testing
To test the HTML interface locally (without API calls working yet):

1. Start a local server:
   ```
   python -m http.server 8000
   ```
2. Open http://localhost:8000 in your browser.
3. The forms will show, but API calls will fail until you deploy and update the API URL.

### API Testing
After deployment:

1. Get the API URL from the SAM output.
2. Update `API_BASE_URL` in `script.js` with your API Gateway URL.
3. Test endpoints with curl:

   Register:
   ```
   curl -X POST https://your-api-url/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

   Login:
   ```
   curl -X POST https://your-api-url/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

4. Or use Postman/Insomnia to test the endpoints.

### Full Testing
1. Deploy the backend.
2. Update the frontend with the API URL.
3. Serve the frontend (e.g., upload to S3 for static hosting).
4. Test registration and login through the web interface.

## Frontend

The HTML files provide separate pages for login and registration:
- `index.html`: Login page with link to registration.
- `register.html`: Registration page with link back to login.
- `styles.css`: Shared styles.
- `script.js`: Handles login form.
- `register.js`: Handles registration form.

To use them:
1. After deployment, update `API_BASE_URL` in both `script.js` and `register.js` with your API Gateway URL.
2. Serve the HTML files from a web server (e.g., S3 static website).

## API Endpoints

- POST /auth/register: Register a new user. Body: { "email": "user@example.com", "password": "password" }
- POST /auth/login: Login. Body: { "email": "user@example.com", "password": "password" } Returns JWT token.

## Notes

- Passwords are hashed using bcrypt.
- JWT expires in 1 hour.
- The DynamoDB table 'Users' is created automatically with the deployment.