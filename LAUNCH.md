# GiftLedger launch week (Nov 10–16, 2026)

**Goal for the season:** 1,000 sign-ups and 100 Season Passes. Most buying happens between Nov 10 and Dec 24, with a big spike around Black Friday (Nov 27). So launch week is about getting the first real users, collecting their words, and fixing what confuses them before Black Friday.

**Rules of thumb**
- Lead with the problem, not the app: "We both bought Grandma the same scarf."
- Show the phone screen. Short, real, slightly messy videos beat polished ads.
- Answer every comment within a few hours during launch week.
- Only post where self-promotion is allowed. Read each group's rules first, and when unsure, ask a moderator.
- Use a link with a source tag so you can see what worked, e.g. `https://yourdomain/?ref=tiktok`. Page views are tracked by path only, so compare sign-ups by day and channel.

---

## Day by day

| Day | Do this |
|---|---|
| **Mon Nov 9 (eve)** | Final checks (`PROGRESS.md` launch checklist). Draft the posts below. Ask 5 friends to be ready to share on day 1. |
| **Tue Nov 10: launch** | Post video #1 on TikTok + Instagram Reels. Personal Facebook post. Text the 5–10 test friends: "It's live, would you share it?" |
| **Wed Nov 11** | Post in 2 parenting groups where it's allowed (see below). Video #2. |
| **Thu Nov 12** | Reddit: one helpful post in an allowed thread (see below). Reply to every comment. |
| **Fri Nov 13** | Video #3. Email anyone who signed up but didn't add a person (from the Supabase dashboard; keep it personal, one or two lines). |
| **Sat Nov 14** | Read feedback emails. List the top 3 confusing things and send them to Claude to fix. |
| **Sun Nov 15** | Video #4 (answer the most common question as a video). |
| **Mon Nov 16** | Review numbers: sign-ups, people added, ideas requested, upgrades. Plan Black Friday week. |

---

## Short video ideas (TikTok, Instagram Reels, YouTube Shorts)

Film on your phone, 15–30 seconds, with on-screen captions (many people watch on mute).

1. **"The scarf incident."** Hook: "My mom and I both bought Grandma the same scarf. Twice." Show marking a gift bought, then the other phone showing it right away. End card: "GiftLedger. Free to start."
2. **"Where did $1,200 go?"** Hook: "January me found out what December me spent." Show the dashboard filling up: green, amber, red. "One budget for every person."
3. **"Stuck on Dad again."** Type Dad's interests and tap Get gift ideas; show 5 ideas inside the budget. "Ideas that fit the budget, not random lists."
4. **"I missed the return window."** Show a gift with a return-by date and the reminder email. "It reminds you 3 days before."
5. **"Keep the surprise."** Show hiding a gift from your partner on a shared list. "We share one list. They can't see their own gifts."
6. **"Teacher gifts in 30 seconds."** Add 3 teachers at $15 each and get ideas. "Done before school pickup."
7. **"$9.99, not a subscription."** "I'm tired of subscriptions too. It's $9.99 once, for the whole season."

Suggested hashtags: #holidaygifts #giftideas #christmasbudget #momlife #budgeting #giftguide #christmasshopping

---

## Posts you can copy

**Facebook / personal**
> I built a little app for something that drives me nuts every year: going over budget on gifts and accidentally buying the same thing as my partner. It's called GiftLedger. You give everyone a budget, get ideas when you're stuck, and share one list with family so nobody doubles up. It also reminds you before return windows close. Free for up to 5 people. If you try it, I'd love to hear what's confusing! [link]

**Parenting group (only where allowed)**
> Mods, please remove if this isn't OK! I made a free tool for holiday gift planning after one too many "wait, you bought that too?" moments. Budget per person, gift ideas, and a shared family list so grandparents can see what's already covered. No app download. I'd honestly love feedback from parents buying for 15+ people. [link]

**Reddit (only in threads or subreddits that allow it)**
> How I keep holiday gift spending under control (with a free tool I made): Each year I list everyone, give each a budget, and track Idea → Bought → Wrapped → Given. The two things that saved me the most money were seeing the running total and sharing the list with my partner, so we stop double-buying. I turned it into a free web app (GiftLedger) [link], but the method works on paper too. Happy to answer questions.

---

## Where to share

Check the current rules before posting. Many communities allow self-promotion only in weekly threads.

- **Facebook:** your own profile, local parents' groups and school PTA groups (ask an admin first), budgeting groups that allow tools.
- **Instagram and TikTok:** your GiftLedger accounts, plus Stories from friends who tried it.
- **Reddit:** look for weekly self-promotion or "tools" threads in budgeting, personal-finance, frugal-living and parenting communities. Answering someone's actual question helpfully is better than a standalone ad. Never post the same text in many places at once.
- **Product Hunt** (optional, a Tuesday or Wednesday): good for a burst of early, tech-savvy feedback.
- **Word of mouth:** each family member who joins a shared list sees the app. A friendly "invite your family" nudge after someone's 3rd person is worth testing in December.

---

## What to watch

- **Sign-ups per day**, and how many reach their first AI idea (PostHog: `signed_up`, `ideas_requested`).
- **Free → paid:** how often people hit a limit (5 people, 10 ideas, 1 family member) and then upgrade (`checkout_started`, `pass_activated`).
- **AI cost:** the daily job emails you if this month's projected cost passes $50.
- **Errors:** Sentry emails you about new problems. Forward anything odd to Claude.
- **Feedback emails** from the "Send feedback" link in Settings.
