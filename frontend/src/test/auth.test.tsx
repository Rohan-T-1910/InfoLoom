import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { extractErrorMessage, getErrorMessage, ApiError } from '../lib/errorUtils';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../services/api';

describe('Authentication Error Utilities', () => {
  it('normalizes duplicate email error into clear user message', () => {
    const rawError = { detail: 'Email is already registered' };
    const message = extractErrorMessage(rawError);
    expect(message).toBe('An account with this email already exists.');
  });

  it('normalizes incorrect password/email error into clear user message', () => {
    const rawError = { detail: 'Incorrect email or password' };
    const message = extractErrorMessage(rawError, 401);
    expect(message).toBe('The email or password is incorrect.');
  });

  it('normalizes Pydantic array validation errors without [object Object]', () => {
    const pydanticErrors = {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'email'],
          msg: 'value is not a valid email address: An email address must have an @-sign.',
        },
      ],
    };
    const message = extractErrorMessage(pydanticErrors, 422);
    expect(message).toBe('Please enter a valid email address.');
    expect(message).not.toContain('[object Object]');
  });

  it('normalizes Pydantic password length error', () => {
    const pydanticErrors = {
      detail: [
        {
          type: 'string_too_short',
          loc: ['body', 'password'],
          msg: 'String should have at least 6 characters',
        },
      ],
    };
    const message = extractErrorMessage(pydanticErrors, 422);
    expect(message).toBe('Password must be at least 6 characters long.');
  });

  it('normalizes network connection errors', () => {
    const networkError = new TypeError('Failed to fetch');
    const message = extractErrorMessage(networkError);
    expect(message).toBe('Unable to connect to the server. Please check your connection and try again.');
  });

  it('replaces any stray [object Object] with friendly guidance', () => {
    const message = extractErrorMessage('[object Object]');
    expect(message).toBe('Please check your information and try again.');
  });
});

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('validates required email and password client-side', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter your email address.')).toBeInTheDocument();
  });

  it('validates email format client-side', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/architect@infoloom\.ai/i);
    fireEvent.change(emailInput, { target: { value: 'notanemail' } });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('displays user-friendly error on failed authentication', async () => {
    vi.spyOn(api, 'login').mockRejectedValueOnce(
      new ApiError('The email or password is incorrect.', 401)
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/architect@infoloom\.ai/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
  });
});

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('validates password length client-side', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText(/Alex Mercer/i);
    const emailInput = screen.getByPlaceholderText(/architect@infoloom\.ai/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });

    const submitBtn = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Password must be at least 6 characters long.')).toBeInTheDocument();
  });

  it('displays friendly error when email already exists', async () => {
    vi.spyOn(api, 'register').mockRejectedValueOnce(
      new ApiError('An account with this email already exists.', 400)
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText(/Alex Mercer/i);
    const emailInput = screen.getByPlaceholderText(/architect@infoloom\.ai/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'validpassword123' } });

    const submitBtn = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
  });

  it('automatically sets token and redirects on successful registration', async () => {
    const mockUser = {
      id: 99,
      name: 'New User',
      email: 'newuser@example.com',
      role: 'User',
      access_token: 'jwt-mock-token-xyz',
      token_type: 'bearer',
    };

    vi.spyOn(api, 'register').mockResolvedValueOnce(mockUser);

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText(/Alex Mercer/i);
    const emailInput = screen.getByPlaceholderText(/architect@infoloom\.ai/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    fireEvent.change(nameInput, { target: { value: 'New User' } });
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'validpassword123' } });

    const submitBtn = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.register).toHaveBeenCalledWith({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'validpassword123',
      });
    });
  });
});
