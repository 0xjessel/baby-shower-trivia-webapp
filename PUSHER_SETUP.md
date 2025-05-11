# Pusher Setup Guide

This document provides instructions for setting up Pusher in your environment without exposing sensitive variable names in public files.

## Required Environment Variables

After creating your Pusher account and app, you'll need to set up the following environment variables:

### Server-side Variables (Keep these secret)

\`\`\`
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret
PUSHER_KEY=your_pusher_key
PUSHER_CLUSTER=your_pusher_cluster
\`\`\`

### Client-side Variables

For client-side usage, you'll need to create two additional environment variables with the `NEXT_PUBLIC_` prefix:

1. One for your Pusher key
2. One for your Pusher cluster

The exact variable names are not listed here for security reasons, but they should match what's used in the codebase. Check the following files to see how these variables are used:

- `lib/pusher-client.ts`
- `hooks/use-pusher.tsx`

## Verifying Your Setup

To verify your Pusher setup is working correctly:

1. Start your development server
2. Navigate to the admin dashboard
3. Check the Pusher connection status indicator
4. If it shows "Connected", your setup is correct

If you encounter any issues, check the browser console for error messages related to Pusher connection failures.
