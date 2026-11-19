import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { api } from '../api/client'

type Key = string
interface Stub {
  status: number
  body: unknown
}

/**
 * Servidor HTTP falso para testes de componentes: substitui o adapter do axios,
 * sem rede. Registre respostas com http.on(método, url, status, corpo).
 */
class FakeHttp {
  private stubs = new Map<Key, Stub>()
  private log: { key: Key; body: unknown }[] = []

  reset() {
    this.stubs.clear()
    this.log = []
  }

  on(method: string, url: string, status: number, body: unknown) {
    this.stubs.set(`${method} ${url}`, { status, body })
  }

  calls(method: string, url: string) {
    return this.log.filter((l) => l.key === `${method} ${url}`).length
  }

  lastBody(method: string, url: string) {
    return [...this.log].reverse().find((l) => l.key === `${method} ${url}`)?.body
  }

  adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = `${config.baseURL ?? ''}${config.url}`.replace('/api/api', '/api')
    const key = `${(config.method ?? 'get').toUpperCase()} ${url}`
    this.log.push({ key, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data })
    const stub = this.stubs.get(key) ?? {
      status: 404,
      body: { code: 'NAO_ENCONTRADO', message: `sem stub para ${key}` },
    }
    const response = { data: stub.body, status: stub.status, statusText: '', headers: {}, config } as AxiosResponse
    if (stub.status >= 400) throw new AxiosError('erro', String(stub.status), config, null, response)
    return response
  }
}

export const http = new FakeHttp()
api.defaults.adapter = http.adapter
axios.defaults.adapter = http.adapter
