"use client";
import { useEffect } from "react";
import { setJwt } from "@/lib/api";

export default function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

    // automatically create demo tenant + user in dev
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/seed`, { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json().catch(() => ({})) : Promise.reject(r)))
      .then((d) => {
        const token = d?.jwt || d?.token || null;
        setJwt(token);
        location.reload();
      })
      .catch((err) => console.error("Auto seed failed", err));
  }, []);

  return null;
}