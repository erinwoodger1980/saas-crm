"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import Image from "next/image";
import { StickyBar } from "@/components/StickyBar";
import { MobileDock } from "@/components/MobileDock";
import { BeforeAfter } from "@/components/BeforeAfter";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID || "";
const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "";
const PHONE = "01892 770123";

// Component code continues...
