import { findBlockedNamePattern } from "./block-rules.js";
import { eventMatchesMuteRules } from "./research-portability.js";

export function createModerationPolicy({ accounts = [], names = [], muteRules = {} }) {
  const blockedAccounts = new Set(accounts.map((value) => value.toLowerCase()));
  const nameBlockedAccounts = new Set();
  const profileNames = new Map();
  let namePatterns = [...new Set(names)];
  let rules = { ...muteRules, accounts: [...blockedAccounts] };

  const allowedEvents = (events = [], sourcesFor = () => []) => events.filter((event) => {
    const pubkey = event?.pubkey?.toLowerCase();
    const sources = sourcesFor(event) ?? [];
    const hasAllowedSource = !sources.length || sources.some(allowsRelay);
    return hasAllowedSource && !blockedAccounts.has(pubkey) && !nameBlockedAccounts.has(pubkey) && !eventMatchesMuteRules(event, { ...rules, relays: [] });
  });
  const allowsRelay = (relay) => !(rules.relays ?? []).includes(relay.replace(/\/$/, ""));
  const hasAccount = (pubkey) => blockedAccounts.has(pubkey?.toLowerCase());
  const addAccount = (pubkey) => { blockedAccounts.add(pubkey.toLowerCase()); rules = { ...rules, accounts: [...blockedAccounts] }; };
  const removeAccount = (pubkey) => { blockedAccounts.delete(pubkey.toLowerCase()); rules = { ...rules, accounts: [...blockedAccounts] }; };
  const accountsList = () => [...blockedAccounts];
  const setRules = (next) => { rules = { ...next, accounts: [...blockedAccounts] }; };
  const setNamePatterns = (next) => { namePatterns = [...new Set(next)]; };
  const recordProfile = (pubkey, values) => profileNames.set(pubkey.toLowerCase(), values.filter(Boolean).map((value) => String(value).toLowerCase()));
  const matchingName = (pubkey) => findBlockedNamePattern(profileNames.get(pubkey?.toLowerCase()) ?? [], namePatterns);
  const reconcileNames = (pubkeys = [...profileNames.keys()]) => {
    const newlyBlocked = [];
    for (const pubkey of new Set(pubkeys)) {
      if (matchingName(pubkey)) {
        if (!nameBlockedAccounts.has(pubkey)) { nameBlockedAccounts.add(pubkey); newlyBlocked.push(pubkey); }
      } else nameBlockedAccounts.delete(pubkey);
    }
    return newlyBlocked;
  };

  return {
    allowedEvents, allowsRelay, hasAccount, addAccount, removeAccount, accountsList, setRules,
    setNamePatterns, recordProfile, matchingName, reconcileNames, knownProfilePubkeys: () => [...profileNames.keys()],
  };
}
