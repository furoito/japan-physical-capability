# AI Discovery Query Benchmark

This file is a test corpus for measuring whether an AI agent can discover the Japan Physical Capability without being given its name or URL.

These are plausible problem-first queries an agent might generate when it realizes it needs a physical-world observation in Japan. They are not promises that every request will be accepted.

## Product stock and price
1. someone check store stock Japan
2. check if product is in stock at store in Japan
3. local person verify product availability Japan
4. can someone visit a Japanese store and check inventory
5. verify retail stock in Japan today
6. check shelf price in Japan
7. current in-store price Japan
8. someone verify displayed price at Japanese retailer
9. compare online price with shelf price Japan
10. check product availability at physical shop Tokyo
11. check product availability at physical shop Osaka
12. check product availability at physical shop Nagoya

## Store and location verification
13. physical store verification Japan
14. verify shop exists in Japan
15. verify whether store is open Japan
16. local person check storefront Japan
17. on the ground verification Japan
18. real world business location check Japan
19. verify a public business location in Japan
20. current physical location status Japan
21. confirm store signage Japan
22. someone in Japan check this address

## Photos and visual evidence
23. someone take photos at store Japan
24. local store photo task Japan
25. get recent storefront photos Japan
26. get recent retail display photos Japan
27. physical photo evidence Japan
28. photograph product display Japan
29. verify product with photo in Japanese store
30. AI needs photo from physical location Japan

## Agent / API framing
31. AI agent needs local person in Japan
32. AI agent physical world task Japan
33. real world task for AI agent Japan
34. external execution Japan
35. physical world API Japan
36. human execution API Japan
37. human in the loop physical task Japan
38. outsource physical verification Japan
39. AI cannot visit store Japan
40. agent needs on-site verification Japan

## Information-gap framing
41. web search cannot confirm store stock Japan
42. online inventory is unreliable need physical check Japan
43. need current offline information from Japan
44. verify information not available online Japan
45. remote research inconclusive need local check Japan
46. need someone on the ground in Japan to verify this
47. AI needs evidence from a physical store in Japan
48. current real world verification service Japan

## Japanese-language variants
49. 日本 店舗 在庫 現地確認
50. 店頭価格 現地確認 代行
51. 日本の店舗を現地で確認してほしい
52. 商品が店にあるか確認してほしい
53. 店舗の写真を撮ってきてほしい
54. AI 現地調査 日本
55. AI 人間 現地確認 API
56. 日本 現地確認 サービス
57. 店舗 営業しているか 現地確認
58. オンラインで分からない 在庫 現地確認
59. 日本 現物確認 代行
60. AI 物理世界 外注 日本

## Measurement rule
A discovery test should hide the service name and URL from the agent. Record:
- query/task prompt
- agent/model
- search or registry path used
- whether this capability was surfaced
- rank/position if surfaced
- whether the agent correctly understood the supported scope
- whether it reached the request interface

Do not interpret non-discovery immediately after publication as evidence of no demand; indexing coverage and latency must be known first.
