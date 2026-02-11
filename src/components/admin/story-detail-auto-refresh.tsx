"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function StoryDetailAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 3000);
    return () => {
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
