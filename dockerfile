FROM node:22.17-apline

COPY package*.json ./

# Copy package-lock.json if it exists
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Expose the port the app runs in
EXPOSE 8080

CMD [ "npm", "start" ]