"use client";
import { useEffect } from "react";

export default function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

    // automatically create demo tenant + user in dev
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/seed`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.jwt) {
          localStorage.setItem("jwt", d.jwt);
          location.reload();
        }
      })
      .catch((err) => console.error("Auto seed failed", err));
  }, []);

  return null;
}