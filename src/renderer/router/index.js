import Router from "vue-router";
import Layout from "@/layout";
export const constantRouterMap = [
  {
    path: "/",
    component: Layout,
    redirect: "/",
    hidden: true,
    children: [
      {
        path: "/",
        name: "项目详情",
        component: () => import("@/views/projectDetail/index"),
        meta: { noSlide: true, title: "项目详情" },
      },
    ],
  },
  {
    path: "/video-manager",
    component: Layout,
    redirect: "/video-manager",
    hidden: true,
    children: [
      {
        path: "/video-manager",
        name: "视频管理",
        component: () => import("@/views/videoManager/index"),
        meta: { noSlide: true, title: "视频管理" },
      },
    ],
  },
  {
    path: "/image-manager",
    component: Layout,
    redirect: "/image-manager",
    hidden: true,
    children: [
      {
        path: "/image-manager",
        name: "图片管理",
        component: () => import("@/views/imageManager/index"),
        meta: { noSlide: true, title: "图片管理" },
      },
    ],
  },
  {
    path: "/source-pool",
    component: Layout,
    redirect: "/source-pool",
    hidden: true,
    children: [
      {
        path: "/source-pool",
        name: "素材池",
        component: () => import("@/views/sourcePool/index"),
        meta: { noSlide: true, title: "素材池" },
      },
    ],
  },
  {
    path: "*",
    component: () => import("@/views/404"),
    hidden: true,
  },
];


const createRouter = () =>
  new Router({
    scrollBehavior: () => ({ y: 0 }),
    routes: constantRouterMap,
  });

export function resetRouter() {
  const newRouter = createRouter();
  router.matcher = newRouter.matcher;
}
const router = createRouter();

export default router;
