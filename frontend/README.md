# Verdict.Games Frontend

This is the frontend application for Verdict.Games, built with Vite and React, featuring Vercel Web Analytics integration.

## Features

- ⚡️ Built with Vite for fast development and optimized builds
- ⚛️ React 19 for building the user interface
- 📊 Vercel Web Analytics integration for tracking user behavior
- 🎨 Modern, responsive design

## Prerequisites

- Node.js 18+ and npm (or pnpm, yarn, bun)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check code quality

## Vercel Web Analytics

This application includes Vercel Web Analytics out of the box. The `<Analytics />` component from `@vercel/analytics/react` is integrated in `src/App.jsx`.

### How it works

Once deployed to Vercel:
1. Enable Web Analytics in your Vercel project dashboard under the **Analytics** tab
2. The analytics will automatically start tracking page views and user interactions
3. You can view your analytics data in the Vercel dashboard

### Local Development

During local development, the Analytics component runs in development mode and won't send data to Vercel unless you're previewing a deployment.

## Deployment

Deploy to Vercel with one command:

```bash
vercel deploy
```

Or connect your Git repository to Vercel for automatic deployments on every push.

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx          # Main App component with Analytics
│   ├── App.css          # App styles
│   ├── main.jsx         # Application entry point
│   └── assets/          # Static assets
├── public/              # Public static files
├── package.json         # Dependencies and scripts
└── vite.config.js       # Vite configuration
```

## Backend API

This frontend connects to the Verdict.Games FastAPI backend. Make sure the backend is running at `http://localhost:8000` for local development.

See the main [README](../README.md) for backend setup instructions.
