// ==UserScript==
// @name            BetterRegexcrossword
// @name:ru         BetterRegexcrossword
// @namespace       https://github.com/tkachen/better-regexcrossword
// @version         0.2.4
// @description     Adds filters and sort options for player puzzles on regexcrossword.com
// @description:ru  Добавляет фильтры и сортировки списка головоломок на regexcrossword.com
// @author          tkachen
// @match           https://regexcrossword.com/*
// @downloadURL     https://github.com/tkachen/better-regexcrossword/raw/main/better-regexcrossword.user.js
// @require         https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require         https://raw.githubusercontent.com/uzairfarooq/arrive/master/minified/arrive.min.js
// @require         https://unpkg.com/regex-colorize@0.0.3/build/index.js
// @grant           none
// ==/UserScript==

(function() {
  'use strict'

  const customListStyles = `
    #listCounter {
      margin-left: auto;
      align-self: center;
      font-size: 20px;
    }

    a[href^="/players/"]:hover,
    a[href^="/playerpuzzles/"]:hover {
      background: hsla(var(--white), 30%);
    }

    .puzzleList {
      display: none;
    }

    .ambiguous {
      background-color:  hsla(var(--on-error),90%);
    }

    .solved {
      background-color: hsl(123,46%,34%);
    }

    .badge {
      color: var(--white) !important;
    }

    .customFilter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .customFilter label {
      display: flex;
      align-items: center;
    }

    .customFilter select {
      background-color: black;
      color: white;
    }
  `

  function customCluesStyle() {
    return `
      .originalClue {
        display: none;
      }

      .regex,
      .regex * {
        -webkit-user-select: text;
        -moz-user-select: text;
        user-select: text;
      }

      .customClue {
        white-space: nowrap;

        &, & * {
          font-weight: normal; font-style: normal; text-decoration: none;
        }
      }

      .customPanelClue {
        display: flex;
        align-items: center;

        &, & * {
          font-weight: normal; font-style: normal; text-decoration: none;
        }
      }

      .infoLink {
        margin-right: 10px;
        color: black;

        & svg {
          height: 24px;
          width: 24px;
        }
      }

      [data-testid="clues"],
      [data-testid="puzzle"] {
        & tbody th:last-child {
          text-align: left;
        }

        & .${clueWrapperClass} {
          background-color: hsla(var(--white),50%);
        }

        & .${clueWrapperActiveClass}.${clueWrapperClass},
        & .${clueWrapperActiveClass} .${clueWrapperClass} {
          background-color: hsla(var(--white),90%);
        }

        & .customPanelClue,
        & .${clueWrapperActiveClass}.${clueWrapperClass},
        & .${clueWrapperActiveClass} .${clueWrapperClass} {
          & .regex       {1font-family: Monospace;}
          & .regex b     {background: #99beff99; color: #000000;} /* metasequence */
          & .regex i     {background: #ffc08099; color: #000000;} /* char class */
          & .regex i b   {background: #e0a06099; color: #000000;} /* char class: metasequence */
          & .regex i u   {background: #d9aa7999; color: #000000;} /* char class: range-hyphen */
          & .regex b.g1  {background: #c5e89399; color: #000000;} /* group: depth 1 */
          & .regex b.g2  {background: #a7bb5a99; color: #000000;} /* group: depth 2 */
          & .regex b.g3  {background: #d5ce6f99; color: #000000;} /* group: depth 3 */
          & .regex b.g4  {background: #ceae6399; color: #000000;} /* group: depth 4 */
          & .regex b.g5  {background: #CE896399; color: #000000;} /* group: depth 5 */
          & .regex b.err {background: #ed5c6599; color: #ffffff;} /* error */
          & .regex .codedChar { background: #ff8def99; }
          & .regex .nonPrintable {
            display: inline-block;
            vertical-align: middle;
            height: 20px;
            min-width: 10px;
            border: 1px solid black;
          }
        }

        ${isHexagonal
          ? `
            & .${hexTopClueClass} .customClue,
            & .${hexLeftClueClass} .customClue,
            & .${hexBottomClueClass} .customClue {
              padding: 0 8px;
            }

            & .${hexTopClueClass} .customClue,
            & .${hexBottomClueClass} .customClue {
              transform: scale(-1);
            }
          `
          : ''
        }
      }
    `
  }

  const svgIcons = {
    solved: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"></path><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>\n',
    unsolved: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg>\n',
    arrow: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg>\n',
    hexagon: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="m20 16c-.001.121-.025.246-.07.362-.08.206-.225.384-.426.5l-6.999 3.999c-.112.064-.232.105-.355.124-.218.034-.445-.003-.654-.124l-6.991-3.995c-.111-.065-.207-.148-.285-.245-.139-.171-.22-.385-.22-.621v-7.993c.001-.128.025-.253.07-.369.08-.206.225-.384.426-.5l6.999-3.999c.112-.064.232-.105.355-.124.218-.034.445.003.654.124l6.991 3.995c.111.065.207.148.285.245.139.171.22.385.22.621zm2 0v-8c-.001-.71-.248-1.363-.664-1.878-.23-.286-.512-.528-.831-.715l-7.009-4.005c-.61-.352-1.3-.465-1.954-.364-.363.057-.715.179-1.037.363l-7.001 4.001c-.618.357-1.06.897-1.299 1.514-.133.342-.202.707-.205 1.077v8.007c.001.71.248 1.363.664 1.878.23.286.512.528.831.715l7.009 4.005c.61.352 1.3.465 1.954.364.363-.057.715-.179 1.037-.363l7.001-4.001c.618-.357 1.06-.897 1.299-1.514.133-.342.202-.707.205-1.084z"></path></svg>\n',
    keyboard: '<svg height="24" viewBox="0 0 27 24" width="27" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="m25.5 3h-24c-.825 0-1.5.675-1.5 1.5v15c0 .825.675 1.5 1.5 1.5h24c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm-10.5 3h3v3h-3zm4.5 4.5v3h-3v-3zm-9-4.5h3v3h-3zm4.5 4.5v3h-3v-3zm-9-4.5h3v3h-3zm4.5 4.5v3h-3v-3zm-7.5-4.5h1.5v3h-1.5zm0 4.5h3v3h-3zm1.5 7.5h-1.5v-3h1.5zm13.5 0h-12v-3h12zm6 0h-4.5v-3h4.5zm0-4.5h-3v-3h3zm0-4.5h-4.5v-3h4.5z"></path></svg>\n',
    info: '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="m12 6q1.641 0 2.813 1.172t1.172 2.813q0 1.266-1.5 2.602t-1.5 2.414h-1.969q0-1.078.469-1.852t1.031-1.125 1.031-.867.469-1.172q0-.797-.609-1.383t-1.406-.586-1.406.586-.609 1.383h-1.969q0-1.641 1.172-2.813t2.813-1.172zm0 14.016q3.281 0 5.648-2.367t2.367-5.648-2.367-5.648-5.648-2.367-5.648 2.367-2.367 5.648 2.367 5.648 5.648 2.367zm0-18q4.125 0 7.055 2.93t2.93 7.055-2.93 7.055-7.055 2.93-7.055-2.93-2.93-7.055 2.93-7.055 7.055-2.93zm-.984 15.984v-2.016h1.969v2.016z"></path></svg>\n',
  }

  const sortOptions = {
    ['ratingAsc']: { label: 'Rating (0 - 5)', field: 'ratingAvg', type: 'number', direction: 'asc' },
    ['ratingDesc']: { label: 'Rating (5 - 0)', field: 'ratingAvg', type: 'number', direction: 'desc' },
    ['sizeAsc']: { label: 'Size (small - big)', field: 'size', type: 'number', direction: 'asc' },
    ['sizeDesc']: { label: 'Size (big - small)', field: 'size', type: 'number', direction: 'desc' },
    ['dateAsc']: { label: 'Date (old - new)', field: 'dateUpdated', type: 'number', direction: 'asc' },
    ['dateDesc']: { label: 'Date (new - old)', field: 'dateUpdated', type: 'number', direction: 'desc' },
    ['nameAsc']: { label: 'Name (A - Z)', field: 'name', type: 'string', direction: 'asc' },
    ['nameDesc']: { label: 'Name (Z - A)', field: 'name', type: 'string', direction: 'desc' },
    ['solvedAsc']: { label: 'Solved (yes - no)', field: 'solved', type: 'boolean', direction: 'asc' },
    ['solvedDesc']: { label: 'Solved (no - yes)', field: 'solved', type: 'boolean', direction: 'desc' }
  }

  const config = {
    filters: {
      showAmbiguous: false,
      showSolved: false,
      showHexagonal: true,
      showSquare: true,
      showMobile: true,
      showDesktop: true
    },
    sortBy: 'ratingDesc'
  }
  const configString = localStorage.getItem('better-regexcrossword')
  if (configString) {
    const localConfig = JSON.parse(configString)
    $.extend(true, config, localConfig)
  } else {
    localStorage.setItem('better-regexcrossword', JSON.stringify(config))
  }

  function updateConfig(data) {
    $.extend(true, config, data)
    localStorage.setItem('better-regexcrossword', JSON.stringify(config))
  }

  function addStyle(content) {
    const style = document.createElement('style')
    style.textContent = content
    document.head.appendChild(style)
  }

  let puzzles = []
  async function getPuzzles() {
    const response = await fetch('https://api.regexcrossword.com/api/puzzles?fields=ambiguous%2CdateUpdated%2Chexagonal%2Cid%2Cmobile%2Cname%2CplayerNo%2CratingAvg%2Csize%2Cvotes')
    puzzles = await response.json()
  }

  let solved = []
  async function getSolved() {
    const appState = JSON.parse(localStorage.getItem('CapacitorStorage.regex-state'))
    if (appState.auth.isAuthenticated) {
      const response = await fetch('https://api.regexcrossword.com/api/solved', {
        headers: { Authorization: `Bearer ${ appState.auth.token }` }
      })
      solved = await response.json()
    } else {
      solved = appState.solved.map(s => s.puzzleId)
    }

    if (puzzles.length) {
      puzzles = puzzles.map((p) => ({ ...p, solved: solved.includes(p.id) }))
    }
  }

  function sortPuzzles(a, b) {
    const sortOption = sortOptions[config.sortBy]
    const [aa, bb] = sortOption.direction === 'asc'
      ? [a[sortOption.field], b[sortOption.field]]
      : [b[sortOption.field], a[sortOption.field]]
    switch (sortOption.type) {
      case 'number':
        return aa - bb
      case 'string':
        return aa.localeCompare(bb)
      case 'boolean':
        if (aa && !bb) return -1
        if (bb && !aa) return 1
        return 0
      default:
        return 0
    }
  }

  function filterPuzzles(puzzle) {
    if (!config.filters.showSolved && puzzle.solved) return false
    if (!config.filters.showAmbiguous && puzzle.ambiguous) return false
    if (!config.filters.showHexagonal && puzzle.hexagonal) return false
    if (!config.filters.showSquare && !puzzle.hexagonal) return false
    if (!config.filters.showMobile && puzzle.mobile) return false
    if (!config.filters.showDesktop && !puzzle.mobile) return false
    return true
  }

  function renderCustomFilters() {
    filtersElement = $('#standard-select').parent().parent()[0]
    $(filtersElement.children).hide()

    $(filtersElement).append(`
      <div class="customFilter">
        <label>
          <input type="checkbox" name="show" id="showSolved" value="solved" ${ config.filters.showSolved ? 'checked' : '' } />
            Solved
        </label>
        <label>
          <input type="checkbox" name="show" id="showAmbiguous" value="ambiguous" ${ config.filters.showAmbiguous ? 'checked' : '' } />
            Ambiguous
        </label>
        <label>
          <input type="checkbox" name="show" id="showHexagonal" value="hexagonal" ${ config.filters.showHexagonal ? 'checked' : '' } />
            Hexagonal
        </label>
        <label>
          <input type="checkbox" name="show" id="showSquare" value="square" ${ config.filters.showSquare ? 'checked' : '' } />
            Square
        </label>
        <label>
          <input type="checkbox" name="show" id="showMobile" value="mobile" ${ config.filters.showMobile ? 'checked' : '' } />
            Mobile
        </label>
        <label>
          <input type="checkbox" name="show" id="showDesktop" value="desktop" ${ config.filters.showDesktop ? 'checked' : '' } />
            Desktop
        </label>
        <select id="sortBy">
        ${ Object.entries(sortOptions).map(([name, opt]) => `<option value="${ name }" ${ name === config.sortBy ? 'selected' : '' }>${ opt.label }</option>`) }
        </select>
      </div>
      <div id="listCounter"><div>
    `)

    $('#showSolved').change(function() {
      updateConfig({ filters: { showSolved: this.checked } })
      renderCustomPuzzleList()
    })
    $('#showAmbiguous').change(function() {
      updateConfig({ filters: { showAmbiguous: this.checked } })
      renderCustomPuzzleList()
    })
    $('#showHexagonal').change(function() {
      updateConfig({ filters: { showHexagonal: this.checked } })
      renderCustomPuzzleList()
    })
    $('#showSquare').change(function() {
      updateConfig({ filters: { showSquare: this.checked } })
      renderCustomPuzzleList()
    })
    $('#showMobile').change(function() {
      updateConfig({ filters: { showMobile: this.checked } })
      renderCustomPuzzleList()
    })
    $('#showDesktop').change(function() {
      updateConfig({ filters: { showDesktop: this.checked } })
      renderCustomPuzzleList()
    })
    $('#sortBy').change(function() {
      updateConfig({ sortBy: this.value })
      renderCustomPuzzleList()
    })
  }

  function renderCustomPuzzleList() {
    if (!customPuzzleListElement) {
      const listWrapper = puzzleListElement.parentElement
      // puzzleListElement.remove();
      customPuzzleListElement = $('<div/>', { 'class': 'customPuzzleList' })[0]
      $(listWrapper).append(customPuzzleListElement)
    } else {
      customPuzzleListElement.textContent = ''
    }

    puzzles.sort(sortPuzzles).filter(filterPuzzles).forEach(renderCustomPuzzleListItem)

    $('#listCounter').text(`${customPuzzleListElement.children.length} / ${puzzles.length}`)
  }

  function renderCustomPuzzleListItem(data) {
    $(customPuzzleListElement).append(`
      <a href="/playerpuzzles/${ data.id }" class="${ puzzleListRowElementClass } ${ data.solved ? 'solved' : '' } ${ data.ambiguous ? 'ambiguous' : '' }" draggable="false">
        <i class="${ puzzleListRowElementIconClass }">${ data.solved ? svgIcons.solved : svgIcons.unsolved }</i>
        <span class="${ puzzleListRowElementNameClass }">${ data.name }</span>
        ${ data.ambiguous ? `<span class="badge ${ puzzleListRowElementBadgeClass } ${ puzzleListRowElementHiddenMobileClass }">Ambiguous</span>` : '' }
        <span class="badge ${ puzzleListRowElementBadgeClass } ${ puzzleListRowElementHiddenMobileClass }">${ new Date(data.dateUpdated * 1000).toLocaleDateString('default') }</span>
        <span class="badge ${ puzzleListRowElementBadgeClass } ${ puzzleListRowElementHiddenMobileClass }">S ${ data.size }</span>
        ${ !data.mobile ? `<i class="${ puzzleListRowElementIconClass }">${ svgIcons.keyboard }</i>` : '' }
        ${ data.hexagonal ? `<i class="${ puzzleListRowElementIconClass }">${ svgIcons.hexagon }</i>` : '' }
        <span class="badge ${ puzzleListRowElementBadgeClass }" title="${ data.votes } votes">R ${ data.ratingAvg }</span>
        <i class="${ puzzleListRowElementIconClass }">${ svgIcons.arrow }</i>
      </a>
    `)
  }

  let filtersElement = null
  let puzzleListElement = null
  let customPuzzleListElement = null
  let puzzleListRowElementClass = ''
  let puzzleListRowElementIconClass = ''
  let puzzleListRowElementNameClass = ''
  let puzzleListRowElementBadgeClass = ''
  let puzzleListRowElementHiddenMobileClass = ''
  function processPuzzleListPage() {
    addStyle(customListStyles)

    filtersElement = null
    puzzleListElement = null
    customPuzzleListElement = null

    document.arrive('a[href^="/playerpuzzles/"]:first-child', { onceOnly: true }, async function(el) {
      document.unbindArrive()

      puzzleListElement = el.parentElement
      puzzleListRowElementClass = el.className
      puzzleListRowElementIconClass = el.children[0].className
      puzzleListRowElementNameClass = el.children[1].className
      puzzleListRowElementHiddenMobileClass = el.children[1].children[0].className
      puzzleListRowElementBadgeClass = el.children[el.children.length - 2].className

      $(puzzleListElement).addClass('puzzleList')

      await getPuzzles()
      await getSolved()
      renderCustomFilters()
      renderCustomPuzzleList()
    })
  }

  let clueWrapperClass = ''
  let clueWrapperActiveClass = ''
  let hexTopClueClass = ''
  let hexLeftClueClass = ''
  let hexBottomClueClass = ''
  function renderCustomClues(puzzle) {
    if (isHexagonal) {
      const firstClueClasses = $('[data-id="field0-0"] > div')[0].className.split(' ')
      clueWrapperClass = firstClueClasses[0]
      clueWrapperActiveClass = firstClueClasses[2]
      const activeClues = $(`.${clueWrapperActiveClass}`)
      hexTopClueClass = activeClues[0].className.split(' ')[1]
      hexLeftClueClass = activeClues[1].className.split(' ')[1]
      hexBottomClueClass = activeClues[2].className.split(' ')[1]
    } else {
      clueWrapperClass = $('tbody tr th', puzzle)[0].className
      clueWrapperActiveClass = $('tbody tr', puzzle)[0].className
    }
    addStyle(customCluesStyle())

    $('input[readonly]', puzzle).each(function(){
      $(this.parentElement).append(`
        <div class="${this.className} customClue regex">${processRegexChars(colorizer.colorizeText(this.getAttribute('value')))}</div>
      `)
      $(this).addClass('originalClue')
    })

    $('.nonPrintable', puzzle).on('click', function() {
      copyToClipboard(this.textContent)
    })

    function replaceClueWithCustom(container) {
      const regexContent = container.textContent.trim();
      if (!regexContent.length) return
      container.textContent = ''
      $(container).addClass('customPanelClue').append(`
        <a href="https://regex101.com/?regex=${encodeURIComponent(regexContent)}&flavor=javascript&flags=gmi"
           class="infoLink"
           target="_blank"
           rel="noreferrer"
           title="Go to regex101.com"
        >${svgIcons.info}</a>
        <div class="regex">${processRegexChars(colorizer.colorizeText(regexContent))}</div>
      `)

      $('.nonPrintable', container).on('click', function() {
        copyToClipboard(this.textContent)
      })
    }

    function callback(mutationList) {
      mutationList.forEach((mutation) => {
        // on user select new cell game replaces custom clue with new regex clue text
        if (mutation.addedNodes.length === 1) {
          replaceClueWithCustom(mutation.target)
        }
      });
    }

    var clues = document.querySelector('[data-testid="clues"]')

    $('[data-testid^="clue-"] > div:not(:first-child)', clues).each(function() {replaceClueWithCustom(this)})

    const observer = new MutationObserver(callback);
    observer.observe(clues, {subtree: true, childList: true});
  }

  function processRegexChars(str) {
    // this is rough version to replace octal codes. it begins from 2 digits to avoid replacement of subpattern matches like \1 \2
    str = str.replace(/\\([0-3]?[0-7]{2})/g,(_, g1) => `<span class="codedChar" title="\\${g1}">${String.fromCharCode(parseInt(g1, 8))}</span>`)
    str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, g1) => `<span class="codedChar" title="\\u${g1}">${String.fromCharCode(parseInt(g1, 16))}</span>`)
    str = str.replace(/\\x([0-9a-fA-F]{2})/g, (_, g1) => `<span class="codedChar" title="\\x${g1}">${String.fromCharCode(parseInt(g1, 16))}</span>`)
    str = str.replace(/([\u0000-\u001F\u00AD])/g, '<span class="nonPrintable" title="$1">$1</span>')
    // some zero-width chars
    str = str.replace(/([\u200b\u200c\u200d\ufeff\u2028\u2029])/g, (_, g1) => `<span class="nonPrintable" title="\\u${g1.charCodeAt(0).toString(16)}">${g1}</span>`)
    return str
  }

  async function copyToClipboard(str) {
    try {
      await navigator.clipboard.writeText(str);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  let colorizer = new window.RegexColorize.default()
  let isHexagonal = null
  function processPuzzlePage() {
    document.arrive('[data-testid="puzzle"]', { onceOnly: true }, function(el) {
      document.unbindArrive()

      // Fix wrapper height on mobile
      el.parentElement.style.height = "100dvh"

      isHexagonal = el.children[0].tagName === 'DIV'
      renderCustomClues(el)
    })
  }

  let previousPath = ''
  const observer = new MutationObserver(() => {
    if (window.location.pathname === previousPath) return

    previousPath = window.location.pathname

    if (window.location.pathname === '/playerpuzzles') {
      processPuzzleListPage()
    } else if (window.location.pathname.startsWith('/playerpuzzles/') || window.location.pathname.startsWith('/puzzles/')) {
      processPuzzlePage()
    }
  })

  observer.observe(document, { subtree: true, childList: true })
})()
