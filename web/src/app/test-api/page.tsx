"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";

export default function TestApiPage() {
  const [results, setResults] = useState<any>({});
  
  useEffect(() => {
    const test = async () => {
      const ids = getAuthIdsFromJwt();
      const apiBase = API_BASE;
      
      // Test 1: Check env vars
      const envVars = {
        NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      };
      
      // Test 2: Check localStorage
      const jwt = localStorage.getItem('jwt');
      
      // Test 3: Check cookies
      const cookies = document.cookie;
      
      // Test 4: Try to fetch tasks
      let tasksResponse = null;
      let tasksError = null;
      try {
        const url = `${apiBase}/tasks?take=10`;
        const headers: any = {
          'Content-Type': 'application/json',
        };
        if (ids?.tenantId) {
          headers['x-tenant-id'] = ids.tenantId;
        }
        if (jwt) {
          headers['Authorization'] = `Bearer ${jwt}`;
        }
        
        const res = await fetch(url, {
          credentials: 'include',
          headers,
        });
        tasksResponse = {
          status: res.status,
          statusText: res.statusText,
          data: await res.json().catch(() => res.text()),
        };
      } catch (err: any) {
        tasksError = err.message;
      }
      
      setResults({
        apiBase,
        envVars,
        authIds: ids,
        jwt: jwt ? jwt.substring(0, 50) + '...' : null,
        cookies,
        tasksResponse,
        tasksError,
        windowLocation: window.location.href,
      });
    };
    
    test();
  }, []);
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Connection Test</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  );
}
