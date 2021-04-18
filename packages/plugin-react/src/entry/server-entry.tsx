import { resolve } from 'path'
import * as React from 'react'
import { StaticRouter } from 'react-router-dom'
import { findRoute, getManifest, logGreen, getCwd } from 'ssr-server-utils'
import { ISSRContext, IGlobal, IConfig, ReactRoutesType, ReactServerESMFeRouteItem } from 'ssr-types'
// @ts-expect-error
import * as Routes from 'ssr-temporary-routes'
import { serverContext } from './create-context'
// @ts-expect-error
import Layout from '@/components/layout/index.tsx'

const { FeRoutes, layoutFetch } = Routes as ReactRoutesType

declare const global: IGlobal

const serverRender = async (ctx: ISSRContext, config: IConfig): Promise<React.ReactElement> => {
  const { cssOrder, jsOrder, dynamic, mode, chunkName } = config
  global.window = global.window ?? {} // 防止覆盖上层应用自己定义的 window 对象
  const path = ctx.request.path // 这里取 pathname 不能够包含 queyString
  const { window } = global
  const routeItem = findRoute<ReactServerESMFeRouteItem>(FeRoutes, path)
  const ViteMode = process.env.BUILD_TOOL === 'vite'

  let dynamicCssOrder = cssOrder

  if (dynamic) {
    dynamicCssOrder = cssOrder.concat([`${routeItem.webpackChunkName}.css`])
  }
  const manifest = ViteMode ? {} : await getManifest()

  const injectCss: JSX.Element[] = []

  if (ViteMode) {
    injectCss.push(<link rel='stylesheet' href={`/server/static/css/${chunkName}.css`} />)
  } else {
    dynamicCssOrder.forEach(css => {
      if (manifest[css]) {
        const item = manifest[css]
        injectCss.push(<link rel='stylesheet' key={item} href={item} />)
      }
    })
  }

  let viteReactScript: boolean|JSX.Element[] = false
  if (ViteMode) {
    viteReactScript = []
    viteReactScript.push(<script src="/@vite/client" type="module" key={'vite-client'}/>)
    viteReactScript.push(<script key={'vite-react-refresh'} type="module" dangerouslySetInnerHTML={{
      __html: ` import RefreshRuntime from "/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true`
    }} />)
  }

  const injectScript = ViteMode ? [<script type="module" src={resolve(getCwd(), '/node_modules/ssr-plugin-react/esm/entry/client-entry.js')} />]
    : jsOrder.map(js => manifest[js]).map(item => <script key={item} src={item} />)

  const staticList = {
    injectCss,
    injectScript
  }
  if (!routeItem) {
    throw new Error(`With request url ${path} Component is Not Found`)
  }

  const isCsr = !!((mode === 'csr' || ctx.request.query?.csr))
  const Component = routeItem.component
  if (isCsr) {
    logGreen(`Current path ${path} use csr render mode`)
  }
  const layoutFetchData = (!isCsr && layoutFetch) ? await layoutFetch(ctx) : null
  const fetchData = (!isCsr && routeItem.fetch) ? await routeItem.fetch(ctx) : null
  const combineData = isCsr ? null : Object.assign({}, layoutFetchData ?? {}, fetchData ?? {})
  const Context = serverContext(combineData) // 服务端需要每个请求创建新的独立的 context
  window.STORE_CONTEXT = Context // 为每一个新的请求都创建一遍 context 并且覆盖 window 上的属性，使得无需通过props层层传递读取

  return (
    <StaticRouter>
      <Context.Provider value={{ state: combineData }}>
        <Layout ctx={ctx} config={config} staticList={staticList} viteReactScript={viteReactScript}>
          {isCsr ? <></> : <Component />}
        </Layout>
      </Context.Provider>
    </StaticRouter>
  )
}

export default serverRender
