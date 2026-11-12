import type { IPublicClientApplication } from '@azure/msal-browser'

export const isDemo = !import.meta.env.VITE_API_BASE_URL
const {
  VITE_ENTRA_TENANT_ID: tenant,
  VITE_ENTRA_CLIENT_ID: clientId,
  VITE_ENTRA_API_SCOPE: scope,
} = import.meta.env
let instance: Promise<IPublicClientApplication> | undefined
function auth() {
  if (!tenant || !clientId || !scope) throw new Error('กรุณาตั้งค่า Entra Tenant, Client ID และ API Scope')
  instance ??= import('@azure/msal-browser')
    .then(({ PublicClientApplication }) =>
      PublicClientApplication.createPublicClientApplication({
        auth: {
          clientId,
          authority: 'https://login.microsoftonline.com/' + tenant,
          redirectUri: location.origin,
        },
        cache: { cacheLocation: 'sessionStorage' },
      }),
    )
    .then(async (client) => {
      const result = await client.handleRedirectPromise()
      if (result?.account) client.setActiveAccount(result.account)
      return client
    })
  return instance
}
export async function signIn(email: string) {
  await (await auth()).loginRedirect({ scopes: [scope], loginHint: email })
}
export async function signOut() {
  const client = await auth()
  await client.logoutRedirect({ account: client.getActiveAccount(), postLogoutRedirectUri: location.origin })
}
export async function accessToken() {
  const client = await auth()
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
  if (!account) throw new Error('กรุณาเข้าสู่ระบบด้วย Microsoft Entra ID')
  client.setActiveAccount(account)
  try {
    return (await client.acquireTokenSilent({ account, scopes: [scope] })).accessToken
  } catch (error) {
    if (error instanceof Error && error.name === 'InteractionRequiredAuthError')
      throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
    throw error
  }
}
