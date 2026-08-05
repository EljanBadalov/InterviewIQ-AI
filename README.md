## Key Features

- 🤖 AI-powered technical interviewer
- 💬 Dynamic follow-up questions
- 📊 Performance analytics
- 📈 Progress tracking
- 🔐 JWT Authentication
- 🌙 Dark mode
- 📱 Responsive design
- ⚡ MERN Stack
- 
# InterviewIQ AI

> **Practice smarter. Interview with confidence.**

InterviewIQ AI is an AI-powered full-stack web application that simulates real technical job interviews. Instead of simply displaying interview questions, the platform creates an interactive interview experience where users answer questions, receive personalized AI feedback, and track their progress over time.

The project is designed as a capstone project for Holberton School and demonstrates modern software engineering practices, including frontend development, backend architecture, database management, authentication, AI integration, and deployment.

---

# Table of Contents

* [Overview](#overview)
* [Problem Statement](#problem-statement)
* [Solution](#solution)
* [Target Users](#target-users)
* [Features](#features)
* [Technology Stack](#technology-stack)
* [System Architecture](#system-architecture)
* [Project Structure](#project-structure)
* [Database Design](#database-design)
* [API Endpoints](#api-endpoints)
* [Security](#security)
* [Future Improvements](#future-improvements)
* [Installation](#installation)
* [Roadmap](#roadmap)
* [Contributors](#contributors)
* [License](#license)

---

# Overview

Preparing for technical interviews is one of the biggest challenges for aspiring software engineers. Most candidates practice by reading interview questions or watching online tutorials, but they rarely receive objective feedback about their answers.

InterviewIQ AI solves this problem by acting as an intelligent interviewer. Users participate in realistic mock interviews where AI evaluates their responses, identifies strengths and weaknesses, asks follow-up questions, and provides personalized recommendations for improvement.

The platform combines artificial intelligence with modern full-stack web technologies to create an engaging and practical interview preparation experience.

---

# Problem Statement

Traditional interview preparation methods have several limitations:

* No personalized feedback
* No realistic interview simulation
* Difficult to measure progress
* Limited opportunities to practice communication skills
* No adaptive follow-up questions

As a result, many candidates struggle during real interviews despite having sufficient technical knowledge.

---

# Solution

InterviewIQ AI provides an interactive AI-powered interview platform where users can:

* Practice technical interviews
* Receive instant AI feedback
* Track interview performance
* Improve weak technical areas
* Build confidence before real interviews

The platform is designed to simulate conversations with an experienced technical interviewer rather than simply displaying static questions.

---

# Target Users

### Primary Users

* Computer Science students
* Software Engineering students
* Bootcamp students
* Junior developers
* Internship applicants
* Career changers

### Secondary Users

* Universities
* Coding bootcamps
* Career centers
* Technical instructors

---

# Features

## User Authentication

* Register
* Login
* Logout
* Secure JWT authentication
* Password hashing

---

## Interview Categories

Users can choose different interview topics including:

* Frontend Development
* Backend Development
* Full Stack Development
* JavaScript
* React
* Node.js
* Python
* SQL
* DevOps
* System Design
* Behavioral Interviews

---

## Difficulty Levels

* Beginner
* Intermediate
* Advanced
* Senior

---

## AI Interview Session

Each interview follows a realistic workflow:

1. User selects category and difficulty
2. AI introduces the interview
3. AI asks a technical question
4. User submits an answer
5. AI evaluates the response
6. AI may ask follow-up questions
7. Final report is generated

---

## AI Feedback

Each answer receives detailed analysis including:

* Technical accuracy
* Completeness
* Communication quality
* Missing concepts
* Overall score
* Suggested improvements
* Example of a better answer

---

## Dashboard

Users can monitor their performance through:

* Interview history
* Average score
* Progress charts
* Strongest categories
* Weakest categories
* Recent activity

---

## Interview Reports

Each completed interview includes:

* Overall score
* Strengths
* Weaknesses
* AI recommendations
* Category breakdown
* Improvement suggestions

---

## Admin Panel

Administrators can:

* Add interview questions
* Edit questions
* Delete questions
* Manage users
* View platform statistics

---

## Technology Stack

This project is built using the MERN stack:

- **MongoDB:** Stores users, interview sessions, questions, answers, and AI feedback.
- **Express.js:** Provides REST API endpoints and handles backend business logic.
- **React:** Builds the interactive and responsive user interface.
- **Node.js:** Runs the backend server.

Additional technologies:

- Mongoose
- JWT
- bcrypt
- Google Gemini API
- Axios
- Tailwind CSS
- Chart.js

---

# System Architecture

```text
                  React Frontend
                      │
                REST API Requests
                      │
              Node.js + Express API
                      │
        Authentication & Business Logic
             │                    │
             │                    │
       MongoDB Atlas         Gemini API
          (Mongoose)
```

---

# Project Structure

```text
interviewiq-ai/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
│
├── server/
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── interviewController.js
│   │   ├── questionController.js
│   │   └── dashboardController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── adminMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Interview.js
│   │   └── Question.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── interviewRoutes.js
│   │   ├── questionRoutes.js
│   │   └── dashboardRoutes.js
│   ├── services/
│   │   └── aiService.js
│   ├── validators/
│   ├── utils/
│   ├── app.js
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── docs/
├── .gitignore
└── README.md
```

---

# Database Design

The application uses **MongoDB** as its primary database. Data is organized into the following collections.

---

## Users Collection

| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Unique user identifier |
| fullName | String | User's full name |
| email | String | Unique email address |
| password | String | Hashed password |
| avatar | String | Profile image URL |
| role | String | User role (user/admin) |
| createdAt | Date | Account creation date |
| updatedAt | Date | Last update date |

---

## Questions Collection

| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Question identifier |
| category | String | Interview category |
| difficulty | String | Beginner / Intermediate / Advanced |
| question | String | Technical interview question |
| tags | [String] | Related technologies |
| createdAt | Date | Creation date |

---

## Interviews Collection

| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Interview identifier |
| user | ObjectId | Reference to Users collection |
| category | String | Interview category |
| difficulty | String | Interview difficulty |
| status | String | In Progress / Completed |
| overallScore | Number | Final interview score |
| startedAt | Date | Interview start time |
| completedAt | Date | Interview completion time |

### Embedded Questions

| Field | Type | Description |
|-------|------|-------------|
| question | String | AI-generated question |
| answer | String | User's answer |
| score | Number | AI evaluation score |
| feedback | String | AI feedback |
| followUpQuestion | String | AI-generated follow-up question |
| improvedAnswer | String | Suggested improved answer |

---

## Progress Collection

| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Progress identifier |
| user | ObjectId | Reference to Users collection |
| totalInterviews | Number | Total completed interviews |
| averageScore | Number | Average interview score |
| strongestCategory | String | Best performing category |
| weakestCategory | String | Lowest performing category |
| updatedAt | Date | Last statistics update |

# REST API

## Authentication

```http
POST /api/auth/register

POST /api/auth/login

GET /api/auth/profile
```

---

## Interview

```http
POST /api/interview/start

POST /api/interview/answer

GET /api/interview/report/:id
```

---

## Dashboard

```http
GET /api/dashboard
```

---

## Admin

```http
POST /api/questions

PUT /api/questions/:id

DELETE /api/questions/:id
```

---

# Security

The application implements several security best practices:

* Password hashing using bcrypt
* JWT authentication
* Protected API routes
* Input validation
* Rate limiting
* CORS
* Helmet
* SQL injection protection
* XSS protection

---

# Future Improvements

The following features are planned for future releases:

* Voice interviews
* Speech-to-text support
* Resume analysis
* ATS resume scoring
* Live coding editor
* Company-specific interview preparation
* Video interview mode
* AI career coach
* Multiplayer mock interviews
* Email reports
* Dark mode
* Mobile application

---

# Installation

Clone the repository:

```bash
git clone https://github.com/your-username/interviewiq-ai.git
```

Install dependencies:

```bash
cd client
npm install

cd ../server
npm install
```

Create environment variables:

```env
DATABASE_URL=

JWT_SECRET=

GEMINI_API_KEY=
```

Run the development servers:

```bash
npm run dev
```

---

# Roadmap

### Phase 1

* Authentication
* Database
* Dashboard

### Phase 2

* Interview system
* AI integration

### Phase 3

* Reports
* Analytics

### Phase 4

* Deployment
* Testing
* Documentation

---

# Contributors

Holberton School Full Stack Software Engineering Final Project

---

# License

This project is developed for educational purposes as a Holberton School capstone project.
