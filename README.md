# OpenHardwareBuilder-Server
PDF and data parsing service for [OpenHardwareBuilder](https://github.com/Davilarek/OpenHardwareBuilder)
# Stuff used
- [pdfdataextract](https://github.com/lublak/pdfdataextract) - easy pdf to text
# How to use
Get NodeJS v14+

Download the repository and run
```
npm i
node .
```
Paste your IP/localhost and port 7778 to OpenHardwareBuilder "PDF parser url" prompt.

It should look like this:
`http://localhost:7778/`

**Please follow this format**

# Request response meanings
Server returns wrong data?
| Message | Context | Meaning                                         |
|---------|---------|-------------------------------------------------|
| OK      | /search | Client sent unknown product brand               |
| NOT OK  | /search | Brand's API returned bad/unknown response       |
| NOT OK  | /get    | Requested URL returned something other than PDF |

# Warning
Some brands might ban your ip if you use this tool too often or purposely spam the API, use at your own risk.
