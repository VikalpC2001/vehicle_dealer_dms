import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { config } from '../config';
import { AppError } from '../utils/app-error';
import * as userRepository from '../repositories/user.repository';
import * as passkeyRepository from '../repositories/passkey.repository';
import { StatusCodes } from 'http-status-codes';
import {
  setRegistrationChallenge,
  consumeRegistrationChallenge,
  setAuthChallenge,
  consumeAuthChallenge,
} from './challenge-store';
import { parseChallengeFromClientDataJSON } from '../utils/webauthn';

const rpID = config.WEBAUTHN_RP_ID;
const rpOrigin = config.WEBAUTHN_RP_ORIGIN;

/**
 * Generates WebAuthn registration options for the given user and stores the challenge.
 */
export async function getRegistrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = await userRepository.findUserByIdWithPasskeys(userId);
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND, 4041);
  }

  const excludeCredentials = user.passkeys.map((p) => ({
    id: p.credentialId,
    transports: p.transports ? (JSON.parse(p.transports) as ('internal' | 'hybrid')[]) : undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName: 'EDealer',
    rpID: rpID === 'localhost' ? 'localhost' : rpID,
    userName: user.emailId,
    userID: Buffer.from(userId, 'utf8'),
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  setRegistrationChallenge(userId, options.challenge);
  return options;
}

/**
 * Verifies the WebAuthn registration response and persists the new passkey.
 */
export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
): Promise<void> {
  const challenge = parseChallengeFromClientDataJSON(response.response.clientDataJSON);
  if (!consumeRegistrationChallenge(challenge, userId)) {
    throw new AppError('Invalid or expired registration challenge', StatusCodes.BAD_REQUEST, 4002);
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: [rpOrigin],
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError('Passkey registration verification failed', StatusCodes.BAD_REQUEST, 4003);
  }

  const { credential } = verification.registrationInfo;
  const credentialIdBase64 = credential.id;
  const publicKeyBuffer = Buffer.from(credential.publicKey);

  await passkeyRepository.createPasskey({
    userId,
    credentialId: credentialIdBase64,
    credentialPublicKey: publicKeyBuffer,
    counter: credential.counter,
    transports: credential.transports ? JSON.stringify(credential.transports) : null,
    deviceType: verification.registrationInfo.credentialDeviceType ?? null,
    backedUp: verification.registrationInfo.credentialBackedUp ?? false,
  });
}

/**
 * Generates WebAuthn authentication options for the given email and stores the challenge.
 */
export async function getAuthenticationOptions(
  email: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const user = await userRepository.findUserByEmailWithPasskeys(email);
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND, 4041);
  }
  if (user.passkeys.length === 0) {
    throw new AppError('No passkeys registered for this account', StatusCodes.BAD_REQUEST, 4004);
  }

  const allowCredentials = user.passkeys.map((p) => ({
    id: p.credentialId,
    transports: p.transports ? (JSON.parse(p.transports) as ('internal' | 'hybrid')[]) : undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: rpID === 'localhost' ? 'localhost' : rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  setAuthChallenge(options.challenge);
  return options;
}

/**
 * Verifies the WebAuthn authentication response, updates the credential counter, and returns the user.
 */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<{ userId: string; emailId: string }> {
  const challenge = parseChallengeFromClientDataJSON(response.response.clientDataJSON);
  if (!consumeAuthChallenge(challenge)) {
    throw new AppError('Invalid or expired authentication challenge', StatusCodes.BAD_REQUEST, 4005);
  }

  const credentialId = response.id;
  const passkey = await passkeyRepository.findPasskeyByCredentialIdWithUser(credentialId);
  if (!passkey) {
    throw new AppError('Passkey not found', StatusCodes.UNAUTHORIZED, 4011);
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: [rpOrigin],
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.credentialPublicKey),
      counter: passkey.counter,
      transports: passkey.transports ? (JSON.parse(passkey.transports) as ('internal' | 'hybrid')[]) : undefined,
    },
  });

  if (!verification.verified) {
    throw new AppError('Passkey verification failed', StatusCodes.UNAUTHORIZED, 4012);
  }

  await passkeyRepository.updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);

  return {
    userId: passkey.user.userId,
    emailId: passkey.user.emailId,
  };
}
