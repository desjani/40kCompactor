FROM node:20-alpine

WORKDIR /usr/src/app

# Copy shared configuration and modules from the parent context
COPY modules ./modules
COPY skippable_wargear.json ./

# Copy the Discord App source code
COPY DiscordApp ./DiscordApp

# Install dependencies for the Discord App
WORKDIR /usr/src/app/DiscordApp
RUN npm install

# Start the bot
CMD ["npm", "start"]
