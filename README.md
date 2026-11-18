# nevinv.com

Personal site. Built with Jekyll and hosted on GitHub Pages: pushing to `main` builds and deploys it.

- `_layouts/default.html`: shared page shell (title bar, header, nav, status bar)
- `_layouts/post.html`: layout for a single post
- `style.css`: the "lowres" theme
- `site.js`: star cursor, dithered background animation, GitHub projects and Codeforces widgets (API results cached in localStorage for 1h)

## Preview

```
jekyll serve --drafts --livereload
```

Then open http://localhost:4000. Drop `--drafts` to see exactly what will be published.

## Writing a post

1. Create `_drafts/my-post.md` and write in markdown, starting with:
   ```
   ---
   title: my post
   summary: one line shown in the post list
   ---
   ```
2. Preview with `jekyll serve --drafts`.
3. To publish, move it to `_posts/YYYY-MM-DD-my-post.md`, commit and push. It shows up at `/posts/my-post/` and in the post lists automatically.

# TODO
- [x] Use local storage to cache so users won't get rate limited
- [x] Complete blog page or just remove (now `posts.html` + Jekyll posts)
- [x] Fix navbar issue
- [ ] Write the first post
- [ ] Spotify "listening.txt" widget: link Spotify to Last.fm, then fetch recent tracks / now playing from the Last.fm API on the client (it allows CORS). If real-time ever matters, swap in a small Cloudflare Worker holding a Spotify refresh token.
- [ ] Pin/choose which projects show instead of just the most recently pushed
