
import { User } from '../types';

// Declare LIFF globally since it's loaded in index.html
declare const liff: any;

// Updated with the user-provided LIFF ID
const LIFF_ID = '2007509057-QWw2WLrq'; 

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export const initLiff = async (): Promise<boolean> => {
  try {
    await liff.init({ liffId: LIFF_ID });
    return true;
  } catch (error) {
    console.error('LIFF Init Error:', error);
    return false;
  }
};

export const getLineProfile = async (): Promise<LineProfile | null> => {
  try {
    if (!liff.isLoggedIn()) {
      liff.login();
      return null;
    }
    const profile = await liff.getProfile();
    return profile;
  } catch (error) {
    console.error('Get Profile Error:', error);
    return null;
  }
};

export const logoutLiff = () => {
  if (liff.isLoggedIn()) {
    liff.logout();
  }
};
