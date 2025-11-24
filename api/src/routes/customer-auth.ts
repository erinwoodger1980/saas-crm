/**
 * Customer Portal Authentication API
 * 
 * Handles login, signup, and password management for ClientUser accounts.
 * Customers can log in to view their quotes, opportunities, and fire door jobs.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

/**
 * POST /api/customer-auth/login
 * Customer login with email and password
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find customer user
    const clientUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        clientAccount: {
          select: {
            id: true,
            tenantId: true,
            companyName: true,
            isActive: true,
          },
        },
      },
    });

    if (!clientUser) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!clientUser.isActive || !clientUser.clientAccount.isActive) {
      return res.status(403).json({ error: "Account is inactive. Please contact support." });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, clientUser.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Update last login
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        clientUserId: clientUser.id,
        clientAccountId: clientUser.clientAccountId,
        tenantId: clientUser.clientAccount.tenantId,
        email: clientUser.email,
        type: "customer",
      },
      env.APP_JWT_SECRET,
      { expiresIn: "7d" } // 7 day sessions for customers
    );

    res.json({
      token,
      user: {
        id: clientUser.id,
        email: clientUser.email,
        firstName: clientUser.firstName,
        lastName: clientUser.lastName,
        companyName: clientUser.clientAccount.companyName,
      },
    });
  } catch (error) {
    console.error("[customer-auth/login] Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/customer-auth/register
 * Register a new customer account (invite-only via tenant)
 * Requires invitation token or admin approval
 */
router.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      jobTitle,
      clientAccountId,
      inviteToken,
    } = req.body;

    if (!email || !password || !firstName || !lastName || !clientAccountId) {
      return res.status(400).json({
        error: "Email, password, first name, last name, and client account ID are required",
      });
    }

    // Verify client account exists and is active
    const clientAccount = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
    });

    if (!clientAccount || !clientAccount.isActive) {
      return res.status(404).json({ error: "Client account not found or inactive" });
    }

    // Check if user already exists
    const existing = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create client user
    const clientUser = await prisma.clientUser.create({
      data: {
        clientAccountId,
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        phone,
        jobTitle,
        isActive: true,
        emailVerified: false, // TODO: Send verification email
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        clientUserId: clientUser.id,
        clientAccountId: clientUser.clientAccountId,
        tenantId: clientAccount.tenantId,
        email: clientUser.email,
        type: "customer",
      },
      env.APP_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: clientUser.id,
        email: clientUser.email,
        firstName: clientUser.firstName,
        lastName: clientUser.lastName,
        companyName: clientAccount.companyName,
      },
    });
  } catch (error) {
    console.error("[customer-auth/register] Error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/customer-auth/forgot-password
 * Request password reset email
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const clientUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!clientUser) {
      return res.json({ message: "If an account exists, a password reset email will be sent" });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { clientUserId: clientUser.id },
      env.APP_JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Save reset token
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        resetToken,
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // TODO: Send email with reset link
    console.log(`[customer-auth] Password reset requested for ${email}, token: ${resetToken}`);

    res.json({ message: "If an account exists, a password reset email will be sent" });
  } catch (error) {
    console.error("[customer-auth/forgot-password] Error:", error);
    res.status(500).json({ error: "Password reset request failed" });
  }
});

/**
 * POST /api/customer-auth/reset-password
 * Reset password with token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required" });
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, env.APP_JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Find user and verify token
    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
    });

    if (!clientUser || clientUser.resetToken !== resetToken) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    if (clientUser.resetTokenExpiry && clientUser.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("[customer-auth/reset-password] Error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
});

/**
 * GET /api/customer-auth/me
 * Get current customer user info
 */
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded: any = jwt.verify(token, env.APP_JWT_SECRET);
    
    if (decoded.type !== "customer") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: decoded.clientUserId },
      include: {
        clientAccount: {
          select: {
            id: true,
            tenantId: true,
            companyName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            postcode: true,
          },
        },
      },
    });

    if (!clientUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: clientUser.id,
        email: clientUser.email,
        firstName: clientUser.firstName,
        lastName: clientUser.lastName,
        phone: clientUser.phone,
        jobTitle: clientUser.jobTitle,
        clientAccount: clientUser.clientAccount,
      },
    });
  } catch (error) {
    console.error("[customer-auth/me] Error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
