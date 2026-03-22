/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🐦</Text>
        <Heading style={h1}>Verify your identity</Heading>
        <Text style={text}>Use the code below to confirm it's you:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code expires shortly. If you didn't request it, ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 25px' }
const logo = { fontSize: '36px', margin: '0 0 16px', textAlign: 'center' as const }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(195, 25%, 14%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(195, 10%, 46%)',
  lineHeight: '1.6',
  margin: '0 0 25px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(181, 42%, 32%)',
  letterSpacing: '4px',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
