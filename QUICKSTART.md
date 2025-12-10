# Meeting Simulator - Quick Start Guide

## 🚀 First Time Setup

### Step 1: Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

### Step 2: Configure Environment

Edit `backend/.env` and set:

```env
# Required: Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Required: Generate with command below
SECRET_KEY=your-generated-secret-key-here
```

Generate SECRET_KEY:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 3: Start Backend

```powershell
# Make sure you're in backend directory with venv activated
uvicorn app.main:app --reload
```

✅ Backend running at: http://localhost:8000
📖 API Docs at: http://localhost:8000/api/v1/docs

### Step 4: Frontend Setup (New Terminal)

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

✅ Frontend running at: http://localhost:3000

## 📝 Using the Application

1. **Register**: Go to http://localhost:3000/register
   - Create your account with email and password

2. **Login**: You'll be redirected to dashboard after registration
   - Or login at http://localhost:3000/login

3. **Create Meeting**:
   - Click "New Meeting" button
   - Enter meeting title and issue
   - Configure agents (default has Alice, Bob, Charlie)
   - Click "Create Meeting"

4. **Run Simulation**:
   - Click "Start Simulation"
   - Watch the dialogue stream in real-time
   - View final decision and summary

## 🔧 Troubleshooting

### Backend won't start
- Check if Python 3.9+ is installed: `python --version`
- Verify .env file exists and has OPENAI_API_KEY
- Check if port 8000 is available

### Frontend won't start
- Check if Node.js 18+ is installed: `node --version`
- Delete node_modules and reinstall: `rm -rf node_modules; npm install`
- Check if port 3000 is available

### Database errors
- Delete `meeting_simulator.db` to reset
- Database is created automatically on first run

### CORS errors
- Verify backend CORS settings in .env
- Make sure frontend is running on http://localhost:3000

### Authentication errors
- Clear browser localStorage
- Re-generate SECRET_KEY if needed
- Check JWT token expiration (default 7 days)

## 🎯 Next Steps

- Read the full README.md for deployment options
- Explore API documentation at http://localhost:8000/api/v1/docs
- Customize agent personas for different scenarios
- Review the code structure to understand the architecture

## 📞 Getting Help

- Check backend logs in terminal
- Check browser console for frontend errors
- Review API responses at http://localhost:8000/api/v1/docs
