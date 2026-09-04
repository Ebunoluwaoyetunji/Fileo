/**
 * Create Account — matches the Figma frame the user provided: FILEO
 * wordmark, "Create your Fileo account" heading, full name / email / phone
 * / password fields, and a "Login" link for existing users.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';

export default function CreateAccountScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleCreateAccount = () => {
    router.push('/(auth)/otp-verification');
  };

  return (
    <AuthScreen
      headingAccent="Create"
      headingRest=" your Fileo account"
      subtitle="Get started with a simpler way to file your taxes"
      ctaLabel="Create Account"
      onSubmitCta={handleCreateAccount}
      bottomText="Already have an account?"
      bottomLinkLabel="Login"
      bottomLinkHref="/(auth)/sign-in"
    >
      <TextField
        label="Full name"
        placeholder="Ada Lovelace"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextField
        label="Email address"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Phone number"
        placeholder="+234 800 000 0000"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
    </AuthScreen>
  );
}
