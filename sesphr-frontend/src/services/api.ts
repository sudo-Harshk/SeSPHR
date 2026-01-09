import axios from "axios"

const api = axios.create({
  baseURL: "/api",   // IMPORTANT
  withCredentials: true,
})

export default api

