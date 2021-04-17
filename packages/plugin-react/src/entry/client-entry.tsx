import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { BrowserRouter, Route, Switch } from 'react-router-dom'
import { preloadComponent } from 'ssr-client-utils'
import { wrapComponent } from 'ssr-hoc-react'
import { IWindow, LayoutProps, ReactClientESMFeRouteItem, ReactRoutesType } from 'ssr-types'
// @ts-expect-error
import * as Routes from 'ssr-temporary-routes'
import { AppContext } from './context'

const { FeRoutes, layoutFetch, App } = Routes as ReactRoutesType

declare const module: any
declare const window: IWindow

const clientRender = async (): Promise<void> => {
  const IApp = App || function (props: LayoutProps) {
    return props.children!
  }
  // 客户端渲染||hydrate
  const routes = await preloadComponent(FeRoutes)
  ReactDOM[window.__USE_SSR__ ? 'hydrate' : 'render'](
    <BrowserRouter>
      <AppContext>
        <IApp>
          <Switch>
            {
            // 使用高阶组件wrapComponent使得csr首次进入页面以及csr/ssr切换路由时调用getInitialProps
              routes.map((item: ReactClientESMFeRouteItem) => {
                const { fetch, component, path } = item
                component.fetch = fetch
                component.layoutFetch = layoutFetch
                const WrappedComponent = wrapComponent(component)
                return (
                  <Route exact={true} key={path} path={path} render={() => <WrappedComponent key={location.pathname}/>}/>
                )
              })
            }
          </Switch>
        </IApp>
      </AppContext>
    </BrowserRouter>
    , document.getElementById('app'))
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept()
  }
}

export default clientRender()
