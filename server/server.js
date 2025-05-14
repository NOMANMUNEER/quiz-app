const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Request and Response Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Log the request
  console.log('\n-------------------');
  console.log(`[${new Date().toISOString()}] Request ${requestId}:`);
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Log request body but mask sensitive data
  const maskedBody = { ...req.body };
  if (maskedBody.password) maskedBody.password = '***';
  if (maskedBody.token) maskedBody.token = '***';
  console.log('Body:', JSON.stringify(maskedBody, null, 2));

  // Capture the response
  const originalSend = res.send;
  res.send = function (body) {
    const responseTime = Date.now() - start;
    
    console.log(`\n[${new Date().toISOString()}] Response ${requestId}:`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Time: ${responseTime}ms`);
    
    // Try to parse and log the response body if it's JSON
    try {
      const responseBody = JSON.parse(body);
      // Mask sensitive data in response
      if (responseBody.token) responseBody.token = '***';
      if (responseBody.password) responseBody.password = '***';
      console.log('Response Body:', JSON.stringify(responseBody, null, 2));
    } catch (e) {
      // If not JSON, log as is
      console.log('Response Body:', body);
    }
    console.log('-------------------\n');

    originalSend.call(this, body);
  };

  next();
});

// Check required environment variables
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in environment variables');
  process.env.JWT_SECRET = 'fallback_secret_key_for_development'; // Temporary fallback
}

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
});

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);

// Database connection check route
app.get('/check', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    res.json({
      status: 'success',
      message: 'Database connection is active',
      timestamp: new Date().toISOString(),
      database: process.env.DB_NAME
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Check if username already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    const [existingEmails] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmails.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );

    console.log('Registration successful:', { username, email, userId: result.insertId });
    
    // Create JWT token for automatic login after registration
    const token = jwt.sign(
      { id: result.insertId, username, isAdmin: false },
      process.env.JWT_SECRET
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: { 
        id: result.insertId, 
        username, 
        isAdmin: false 
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Login request received:', { ...req.body, password: '***' });
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      console.log('Missing credentials:', { username: !!username, password: !!password });
      return res.status(400).json({ 
        error: 'Username and password are required',
        details: 'Both username and password must be provided'
      });
    }

    // Query database for user
    console.log('Querying database for user:', username);
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    ).catch(err => {
      console.error('Database query error:', err);
      throw new Error('Database query failed');
    });

    console.log('Database query result:', { 
      userFound: users.length > 0,
      username: username 
    });

    if (users.length === 0) {
      return res.status(400).json({ 
        error: 'User not found',
        details: 'No user exists with this username'
      });
    }

    const user = users[0];
    console.log('Found user:', { 
      id: user.id, 
      username: user.username,
      hasPassword: !!user.password 
    });

    // Verify password
    try {
      console.log('Comparing passwords...');
      const validPassword = await bcrypt.compare(password, user.password);
      console.log('Password comparison result:', validPassword);

      if (!validPassword) {
        return res.status(400).json({ 
          error: 'Invalid password',
          details: 'The provided password is incorrect'
        });
      }
    } catch (bcryptError) {
      console.error('Password comparison error:', bcryptError);
      return res.status(500).json({ 
        error: 'Error validating password',
        details: bcryptError.message
      });
    }

    // Generate JWT token
    try {
      console.log('Generating JWT token...');
      const tokenData = { 
        id: user.id, 
        username: user.username, 
        isAdmin: user.is_admin 
      };
      
      const token = jwt.sign(
        tokenData,
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('JWT token generated successfully');

      // Send response
      const response = { 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          isAdmin: user.is_admin 
        } 
      };
      
      console.log('Sending successful login response');
      res.json(response);
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({ 
        error: 'Error generating authentication token',
        details: jwtError.message
      });
    }
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Token validation endpoint
app.get('/api/validate-token', authenticateToken, (req, res) => {
  // If the middleware passes, the token is valid
  res.json({ valid: true, user: req.user });
});

// Questions routes
app.get('/api/questions', authenticateToken, async (req, res) => {
  try {
    const [questions] = await pool.execute('SELECT * FROM questions');
    
    // Parse the options JSON for each question
    const parsedQuestions = questions.map(question => ({
      ...question,
      options: JSON.parse(question.options)
    }));
    
    res.json(parsedQuestions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/questions', authenticateToken, async (req, res) => {
  try {
    const { question, options, correct_answer, time_limit } = req.body;
    
    // Input validation
    if (!question || !options || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ 
        error: 'Invalid question format',
        details: 'Question must have text and exactly 4 options'
      });
    }

    if (typeof correct_answer !== 'number' || correct_answer < 0 || correct_answer > 3) {
      return res.status(400).json({ 
        error: 'Invalid correct answer',
        details: 'Correct answer must be a number between 0 and 3'
      });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Only admins can add questions' });
    }

    console.log('Adding new question:', {
      question,
      optionsCount: options.length,
      correct_answer,
      time_limit
    });

    const [result] = await pool.execute(
      'INSERT INTO questions (question, options, correct_answer, time_limit, created_by) VALUES (?, ?, ?, ?, ?)',
      [question, JSON.stringify(options), correct_answer, time_limit, req.user.id]
    );

    console.log('Question added successfully:', result);

    res.status(201).json({ 
      message: 'Question added successfully',
      questionId: result.insertId
    });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ 
      error: 'Failed to add question',
      details: error.message
    });
  }
});

// User scores routes
app.post('/api/scores', authenticateToken, async (req, res) => {
  try {
    const { score, totalQuestions } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO user_scores (user_id, score, total_questions) VALUES (?, ?, ?)',
      [req.user.id, score, totalQuestions]
    );

    res.status(201).json({ message: 'Score saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 