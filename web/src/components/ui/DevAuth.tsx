"use client";
import { useEffect } from "react";
import { API_BASE, setJwt } from "@/lib/api";

export default function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // only run on localhost
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) return;

    if (localStorage.getItem("jwt")) return;

    // automatically create demo tenant + user (local only)
    fetch(`${API_BASE}/seed`, { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.jwt) {
          setJwt(d.jwt);
          location.reload();
        }
      })
      .catch((err) => console.error("Auto seed failed", err));
  }, []);

  return null;
}