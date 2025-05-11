# Mobile Trivia Game Platform

A real-time interactive trivia game platform designed for mobile devices, perfect for events, parties, and gatherings. Players can join via QR code, answer questions, submit custom answers, and compete for the highest score.

## Screenshots

<div align="center">
  <img src="/public/images/homepage.png" alt="Homepage with QR code" width="300"/>
  <p><em>Homepage with QR code for easy joining</em></p>
</div>

<div align="center">
  <img src="/public/images/question-trivia.png" alt="Player view of trivia question" width="300"/>
  <p><em>Player view of an active trivia question</em></p>
</div>

<div align="center">
  <img src="/public/images/image-question-custom-answer.png" alt="Image question with custom answers" width="300"/>
  <p><em>Questions can include images and players can submit custom answers</em></p>
</div>

<div align="center">
  <img src="/public/images/results-page.png" alt="Results page with leaderboard" width="300"/>
  <p><em>Results page showing victory screen, player ranking, and leaderboard</em></p>
</div>

<details>
  <summary><strong>Admin Dashboard (Click to expand)</strong></summary>
  <div align="center">
    <img src="/public/images/admin-dashboard.png" alt="Admin dashboard" width="500"/>
    <p><em>Admin dashboard for managing questions and game flow</em></p>
  </div>
</details>

## Features

- **Real-time Interaction**: Instant updates for all players using Pusher
- **Multiple Game Support**: Create and manage multiple trivia games
- **Custom Answer Submission**: Players can submit their own answers if enabled
- **Admin Dashboard**: Comprehensive controls for game hosts
- **Mobile-First Design**: Optimized for smartphones and tablets
- **QR Code Join**: Easy game access via scannable QR codes
- **Live Player Tracking**: See who's online and participating
- **Victory Celebrations**: Special animations and screens for winners
- **Flexible Question Types**: Support for questions with or without correct answers
- **Image Questions**: Add images to make your trivia more engaging
- **Leaderboard**: Real-time rankings of players based on correct answers

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Pusher
- **Deployment**: Vercel (recommended)

## Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account
- Pusher account

## Environment Variables

Create a `.env.local` file in the root directory. You'll need to set up the following types of variables:

\`\`\`
# Supabase Configuration
# Your Supabase URL and keys

# Pusher Configuration
# Server-side Pusher credentials
# Client-side Pusher credentials (with NEXT_PUBLIC prefix)

# Admin Authentication
# Password for admin access
\`\`\`

For security reasons, we don't list the exact variable names here. Please refer to the `.env.example` file in the repository for the specific environment variables needed.

## Database Setup

1. Create a new Supabase project
2. Run the migration scripts in the following order:
   - `sql/reset-schema.sql` (if starting fresh)
   - `sql/supabase-schema.sql`
   - `sql/migration-add-game-support.sql`
   - `sql/migration-remove-current-game.sql`
   - `sql/migration-add-no-correct-answer.sql`
   - `sql/migration-add-allows-custom-answers.sql`

You can run these scripts in the Supabase SQL Editor or use the migration UI component in the admin dashboard.

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/mobile-trivia-game.git
cd mobile-trivia-game

# Install dependencies
npm install

# Copy the example environment file and fill in your values
cp .env.example .env.local

# Run the development server
npm run dev
\`\`\`

## Usage

### Admin Setup

1. Navigate to `/admin` and enter your admin password
2. Create a new game or select an existing one
3. Add questions to your game
4. Start the game when ready

### Player Participation

1. Players navigate to the main URL or scan the QR code
2. They enter their name to join
3. When the game starts, they can answer questions and submit custom answers
4. Results are displayed in real-time

## Project Structure

\`\`\`
├── app/                  # Next.js App Router pages
│   ├── admin/            # Admin dashboard
│   ├── api/              # API routes
│   ├── game/             # Game interface
│   ├── join/             # Player join page
│   └── results/          # Results display
├── components/           # React components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── public/               # Static assets
├── sql/                  # SQL migration scripts
└── types/                # TypeScript type definitions
\`\`\`

## Key Components

- **Game Manager**: Controls game flow and state
- **Question Form**: For creating and editing questions
- **Question List**: Displays and manages questions
- **Player Heartbeat**: Tracks online players
- **Victory Overlay**: Celebrates winners
- **Pusher Integration**: Handles real-time updates

## Deployment

This project is optimized for deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure the environment variables (refer to `.env.example`)
4. Deploy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [Pusher](https://pusher.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
