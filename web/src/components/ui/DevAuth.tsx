"use client";
import { useEffect } from "react";
import { API_BASE, setJwt, apiFetch } from "@/lib/api";

export default function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // only run on localhost
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) return;

    if (localStorage.getItem("jwt")) return;

    // automatically create demo tenant + user (local only)
    (async () => {
      try {
        const d = await apiFetch<any>("/seed", { method: "POST", credentials: "omit" });
        const token = d?.token || d?.jwt;
        if (token) {
          setJwt(token);
          location.reload();
        }
      } catch (err) {
        console.error("Auto seed failed", err);
      }
    })();
  }, []);

  return null;
}