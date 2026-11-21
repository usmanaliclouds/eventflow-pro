# Works on any host that can run a Dockerfile (Render, Railway, Koyeb, Fly.io…)
FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=4000 OTP_DEMO=1
EXPOSE 4000
CMD ["npm", "start"]
