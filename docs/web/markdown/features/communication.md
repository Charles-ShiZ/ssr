# 组件通信

数据管理是前端开发中重要的一环知识。在组件层级过多时通过 `props` 传递非常的苦难，我们通常会使用额外的数据管理库来进行数据管理。同样数据管理从最初的 `flux` 架构到现在最新的 `context` 思路经过了无数变迁，在业界也有着非常非常多的方案。本章节将讲述在 `ssr` 框架中我们如何进行数据管理 

> 在阅读本章节之前，请确保你已经阅读并熟悉这两个章节的内容[目录结构](/docs/features$structure)和[数据获取](/docs/features$fetch)。

## 发展历史

数据管理方案从最早的 `flux` 架构提出，即 `视图层组件不允许直接修改应用状态，只能触发 action。应用的状态必须独立出来放到 store 里面统一管理，通过侦听 action 来执行具体的状态操作`。也就是大家熟知的 `单向数据流`。当然真实应用中，我们不可能所有的状态都放在 `store` 中，组件仍然可以拥有并且直接修改自己的 `私有状态`。

实现 `单向数据流` 又分为两大派系。

分别是 `immutable` 思想的 `react-redux`, `redux-(thunk|sage)`, `dva`, `redux-toolkit` 等等

以及基于 `observer` 思想的 `mobx`, `vuex` 等等

也有些开发者认为 `React+Mobx`，就是类型友好的干净版 `Vue`, 虽然上述方案没有绝对的优劣之分。但从开发者体验的角度来看基于 `observer` 思想实现的方案在编写舒适度上是要更优的。

由于数据管理没有唯一答案，所以在 `ssr` 框架中我们`可能`会在框架层面提供多种方案让用户进行选择。但我们始终建议使用框架默认支持的方案，不要自行引入外部方案。我们也会不断的完善这一块的内容。

## Vue 场景解决方案

在 `Vue` 场景中，我们提供了大家熟知的 [Vuex](https://vuex.vuejs.org/) 作为解决方案。另外，在 `Vue3` 场景中，我们额外提供了 [Provide/Inject](https://v3.cn.vuejs.org/guide/composition-api-provide-inject.html#%E4%BF%AE%E6%94%B9%E5%93%8D%E5%BA%94%E5%BC%8F-property) 方案来帮助各位简化这一功能。

### Vuex

`Vuex` 的具体使用方案，开发者可以查看它的官方文档。这里不进行赘述。在[数据获取](/docs/features$fetch)章节中，我们提出了用 `fetch.ts` 来进行数据的获取。在 `fetch.ts` 中我们可以拿到 `vuex` 的实例来进行相关操作
### Provide/Inject

在 `Vue3` 中我们提供了另一种更加轻量级的跨组件数据共享的方式，也就是 `Provide/Inject` ， `Vuex` 和 `Provide/Inject` 主要的区别在于， `Vuex` 中的全局状态的每次修改是可以追踪回溯的，而 `provide/inject` 中变量的修改是无法控制的，换句话说，你不知道是哪个组件修改了这个全局状态。

在中小型应用中，若你完全不考虑使用 `Vuex` 来做数据管理的话，那么你可以不使用默认的示例 `Vuex` 全部有关代码，但暂时不要删除 `store` 的入口文件，后续会底层兼容不存在 `store` 文件的情况。

在渲染的过程中，我们会将 `layout fetch` 与 `page fetch` 的 `返回数据` 组合后以 `props` 的形式注入到 `layout/App.vue` 当中，开发者可以在该文件当中 `provide` 如下所示。

```html
// layout/App.vue
<script>
import { reactive, provide } from 'vue'
export default {
  props: ['asyncData'],
  setup (props) {
    const reactiveAsyncData = reactive(props.asyncData) // asyncData.value 是 fetch.ts 的返回值，将 provide 的数据变为响应式
    const changeAsyncData = (data) => {
      reactiveAsyncData.value = data
    }
    provide('asyncData', reactiveAsyncData)
    provide('changeAsyncData', changeAsyncData)
  }

}
</script>
```

便可以在任意组件中通过 `inject` 拿到该数据并且可以修改数据自动触发更新，为了防止应用数据混乱，我们建议为不同的组件返回数据添加不同的 `namespace` 命名空间。同样当路由切换时我们也会自动的将 `fetch.ts` 返回的数据合并进 `asyncData`。  

为了防止对象失去响应性，这里我们 follow `ref 对象`的规则。将真正的数据对象存放在 `asyncData.value` 字段中。并且将整个 `asyncData` 转换为响应式。这样我们后续可以直接通过修改 `asyncData.value = obj ` 或者 `asyncData.value.key = obj` 的方式来修改数据仍然可以让对象`保持响应式`。使用这种方式需要注意的是如果在 `template` 中使用的话仍然需要添加 `.value` 取值不会自动展开。  

```html
// 任意组件
<template>
  {{ asyncData.value }}
</template>

<script>
export default {
 setup () {
    const asyncData = inject('asyncData')
    const changeAsyncData = inject('changeAsyncData')
    return {
      asyncData,
      changeAsyncData
    }
  },
  mounted () {
    // 通过 changeAsyncData 修改响应式数据
    this.changeAsyncData({
      namespace: 'foo'
    })
  }
}
</script>
```

## React 场景

在 `React` 场景中，我们没有使用上述的任何一种数据管理方案，我们采用了思想上与 `Provide/Inject` 类似的，同样也是 [react-hooks](https://reactjs.org/docs/hooks-intro.html) 出现后出现在大家视野的 [useContext](https://reactjs.org/docs/hooks-reference.html#usecontext)

### Hooks

随着 `hooks` 的流行以及 `useContext` 这个 API 的推出, 越来越多的开发者希望用它来代替 `Dva`, `Redux` 这些方案来实现数据管理，因为之前的数据管理方案写起来实在是太累了。  

先说结论：`useContext + useReducer` 不能完全代替 `Redux` 的功能。但对于大多数应用来说它已足够够用。本框架没有使用 `任何` 基于 hooks 新造的第三方轮子来做数据通信，仅使用 `React` 提供的最原始的 `API` 来实现跨组件通信。如果你只是想进行跨组件通信，以及数据的自动订阅更新能力，你完全不需要 `Redux`。

通过使用 `useContext` 来获取全局的 `context`, `useContext` 返回两个值分别为

- state: 全局的状态，可在不同的组件/页面之间共享
- dispatch: 通过 `disptach` 来触发类型为 `updateContext` 的 `action` 来更新最顶层的 `context`

> 注: hooks 只能够在函数组件内部使用

```ts
import { useContext } from 'react'
import { IContext } from 'ssr-types'

// 通过 IData 指定模块自己的 data interface

const { state, dispatch } = useContext<IContext<IData>>(window.STORE_CONTEXT)
```

通过 `dispatch action` 来触发全局 `context` 的更新，并通知到所有的组件。在本地开发环境下我们会在控制台中输出每个修改 context 的 action 的详细信息。 

> 注: dispatch 是异步的只能够在客户端渲染的阶段使用，服务端使用无效。context 更新会导致所有组件重新 render，我们需要使用 React.useMemo 来避免不必要的重新计算，且建议根据不同的模块使用不同的 namespace 防止数据覆盖

```js
import React, { useContext } from 'react'
import styles from './index.less'

function Search (props) {
  const { state, dispatch } = useContext<IContext<SearchState>>(window.STORE_CONTEXT)
  const handleChange = e => {
    dispatch({
      type: 'updateContext',
      payload: {
        search: {
          // 搜索框模块的 namespace 为 search
          text: e.target.value
        }
      }
    })
  }
   return (
    <div className={styles.searchContainer}>
      <input type="text" className={styles.input} value={state.search?.text ?? ''} onChange={handleChange} placeholder="该搜索框内容会在所有页面共享"/>
      <img src="https://img.alicdn.com/tfs/TB15zSoX21TBuNjy0FjXXajyXXa-48-48.png" alt="" className={styles.searchImg} onClick={toSearch}/>
    </div >
  )
}

export default Search

```

> 注: 以上只为示例，实际开发中我们只推荐在跨组件通信时使用 dispatch，局部状态应该使用 useState 来实现，否则会导致函数内部状态过于复杂，难以追踪。

关于更多 `hooks` 使用的最佳实践可以参考该[文章](https://zhuanlan.zhihu.com/p/81752821)

我们只有一个最顶层的 `store`，以及一个 `reducer` 来修改这个 `store`。综上本方案的优点以及不足如下  

优势:
- 无需再编写繁琐的单向数据流相关代码
- 共享全局状态以及修改全局状态非常简单自然

不足
- 在大型应用状态复杂的情况下，比较难以管理
- 需要配合 `useMemo` 一起使用，否则容易导致性能问题 (只要是使用了 `useContext` 都会遇到该问题)

在大型应用可能需要考虑拆分成多个 `Context.Provider` 的组织形式来避免意外的重新 `render`。后续我们会继续跟进最佳实践  
