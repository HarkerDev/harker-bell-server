FROM node:lts

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY . .

ENV NODE_ENV production
EXPOSE 5000

CMD ["npm", "run", "start"]