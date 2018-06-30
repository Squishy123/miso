FROM node:10

# Create App Directory
WORKDIR ./

# Install App Dependencies
COPY package*.json ./

RUN npm install 

# Bundle App Source
COPY . .

# Expose Port
EXPOSE 8000
CMD [ "npm",  "start" ]