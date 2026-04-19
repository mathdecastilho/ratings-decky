import {
  afterPatch,
  findInReactTree,
  appDetailsClasses,
  createReactTreePatcher,
} from '@decky/ui'
import { routerHook } from '@decky/api'
import { ReactElement } from 'react'
import RatingBadges from '../components/RatingBadges'

// The library app route provides the appid in the URL: /library/app/:appid
// We patch the render tree to inject our badge into the game detail page.
export default function patchLibraryApp() {
  return routerHook.addPatch('/library/app/:appid', (tree: any) => {
    const routeProps = findInReactTree(tree, (x: any) => x?.renderFunc)
    if (!routeProps) return tree

    const patchHandler = createReactTreePatcher(
      [(tree: any) => findInReactTree(tree, (x: any) => x?.props?.children?.props?.overview)?.props?.children],
      (_: Array<Record<string, unknown>>, ret?: ReactElement) => {
        const container = findInReactTree(
          ret,
          (x: ReactElement) =>
            Array.isArray((x as any)?.props?.children) &&
            (x as any)?.props?.className?.includes(appDetailsClasses.InnerContainer)
        )
        if (typeof container !== 'object') return ret

        // Guard against duplicate injection on re-renders
        const alreadyInjected = container.props.children.some(
          (c: any) => c?.type === RatingBadges
        )
        // Extract appId from overview; non-Steam apps either have no appid or a non-numeric one
        const overview = findInReactTree(ret, (x: any) => x?.props?.overview)?.props?.overview
        const rawAppId = overview?.appid
        const appId = rawAppId && /^\d+$/.test(String(rawAppId)) ? String(rawAppId) : ''

        if (alreadyInjected) {
          // Update the existing badge's appId prop in-place
          const existing = container.props.children.find((c: any) => c?.type === RatingBadges)
          if (existing) existing.props.appId = appId
          return ret
        }

        container.props.children.splice(1, 0, <RatingBadges appId={appId} />)
        return ret
      }
    )

    afterPatch(routeProps, 'renderFunc', patchHandler)
    return tree
  })
}
