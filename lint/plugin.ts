import { commentStyle, noLowValueComments } from "./comment-style.ts";

export default {
  meta: { name: "aria-arcade" },
  rules: {
    "comment-style": commentStyle,
    "no-low-value-comments": noLowValueComments,
  },
};
