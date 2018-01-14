# Super performant text container built upon caches

## Usage

### Install

```bash
npm i text-store
```

### Light it up

```javascript
import TextStore from 'text-store';

const bigA$$File = new TextStore('really big file');

```

## [Documentation](https://chipto.github.io/text-store/classes/textstore.html)

## You might want it if:

- You're working with really massive text files, and you will be doing frequent content manipulations here and there

- You need to frequently convert between line:col based addressing and index based addressing

- You will be doing both of above, thats the best use case, as `TextStore` uses caches, and re-computes only whats really needed

- You have two libraries/apps where one uses line:col based addressing and other uses index based, `TextStore` can act as glue code

> `TextStore` really shines when an instance is used frequently and not just once or twice. First call to, for example `indexToPosition` will be
significantly slower as that's when `TextStore` will build it's internal cache, which is used to serve subsequent calls at lightning speeds
