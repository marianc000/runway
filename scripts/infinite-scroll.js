

(function (scope) {

  // Number of items to instantiate beyond current view in the scroll direction.
  var RUNWAY_ITEMS = 50;

  // Number of items to instantiate beyond current view in the opposite direction.
  var RUNWAY_ITEMS_OPPOSITE = 10;

  // The number of pixels of additional length to allow scrolling to.
  var SCROLL_RUNWAY = 2000;

  // The animation interval (in ms) for fading in content from tombstones.
  var ANIMATION_DURATION_MS = 200;



  /**
   * Construct an infinite scroller.
   * @param {Element} scroller The scrollable element to use as the infinite
   *     scroll region.
   * @param {InfiniteScrollerSource} source A provider of the content to be
   *     displayed in the infinite scroll region.
   */
  scope.InfiniteScroller = function (scroller, source) {
    this.anchorItem = { index: 0, offset: 0 };
    this.firstAttachedItem_ = 0;
    this.lastAttachedItem_ = 0;
    this.anchorScrollTop = 0;
    this.tombstoneSize_ = 79; //by me
    this.tombstoneWidth_ = 1683;//by me
    this.tombstones_ = [];
    this.scroller_ = scroller;
    this.source_ = source;
    this.items_ = [];
    this.loadedItems_ = 0;
    this.requestInProgress_ = false;
    this.scroller_.addEventListener('scroll', this.onScroll_.bind(this));

    // Create an element to force the scroller to allow scrolling to a certain
    // point.
    this.scrollRunway_ = document.createElement('div');
    // Internet explorer seems to require some text in this div in order to
    // ensure that it can be scrolled to.
    this.scrollRunway_.textContent = ' ';
    this.scrollRunwayEnd_ = 0;
    this.scrollRunway_.style.position = 'absolute';
    this.scrollRunway_.style.height = '1px';
    this.scrollRunway_.style.width = '1px';
    // this.scrollRunway_.style.transition = 'transform 0.2s';
    this.scroller_.appendChild(this.scrollRunway_);
    this.onScroll_();
  }

  scope.InfiniteScroller.prototype = {
    /**
     * Called when the scroller scrolls. This determines the newly anchored item
     * and offset and then updates the visible elements, requesting more items
     * from the source if we've scrolled past the end of the currently available
     * content.
     */
    onScroll_: function () {
      console.log(">onScroll_ this.items=" + this.items_.length + "; this.scroller_.scrollTop=" + this.scroller_.scrollTop + "; this.anchorScrollTop=" + this.anchorScrollTop);
      var delta = this.scroller_.scrollTop - this.anchorScrollTop;
      // Special case, if we get to very top, always scroll to top.
      if (this.scroller_.scrollTop == 0) {
        this.anchorItem = { index: 0, offset: 0 };
      } else {
        this.anchorItem = this.calculateAnchoredItem(this.anchorItem, delta);
      }
      this.anchorScrollTop = this.scroller_.scrollTop;
      var lastScreenItem = this.calculateAnchoredItem(this.anchorItem, this.scroller_.offsetHeight);
      if (delta < 0)
        this.fill(this.anchorItem.index - RUNWAY_ITEMS, lastScreenItem.index + RUNWAY_ITEMS_OPPOSITE);
      else
        this.fill(this.anchorItem.index - RUNWAY_ITEMS_OPPOSITE, lastScreenItem.index + RUNWAY_ITEMS);
    },

    /**
     * Calculates the item that should be anchored after scrolling by delta from
     * the initial anchored item.
     * @param {{index: number, offset: number}} initialAnchor The initial position
     *     to scroll from before calculating the new anchor position.
     * @param {number} delta The offset from the initial item to scroll by.
     * @return {{index: number, offset: number}} Returns the new item and offset
     *     scroll should be anchored to.
     */
    calculateAnchoredItem: function (initialAnchor, delta) {
      console.log(">calculateAnchoredItem this.items=" + this.items_.length + "; initialAnchor=" + JSON.stringify(initialAnchor) + "; delta=" + delta);
      if (delta == 0)
        return initialAnchor;
      delta += initialAnchor.offset;
      var i = initialAnchor.index;
      var tombstones = 0;
      if (delta < 0) {
        while (delta < 0 && i > 0 && this.items_[i - 1].height) {
          delta += this.items_[i - 1].height;
          i--;
        }
        tombstones = Math.max(-i, Math.ceil(Math.min(delta, 0) / this.tombstoneSize_));
      } else {
        while (delta > 0 && i < this.items_.length && this.items_[i].height && this.items_[i].height < delta) {
          delta -= this.items_[i].height;
          i++;
        }
        if (i >= this.items_.length || !this.items_[i].height)
          tombstones = Math.floor(Math.max(delta, 0) / this.tombstoneSize_);
      }
      i += tombstones;
      delta -= tombstones * this.tombstoneSize_;
      return {
        index: i,
        offset: delta,
      };
    },

    /**
     * Sets the range of items which should be attached and attaches those items.
     * @param {number} start The first item which should be attached.
     * @param {number} end One past the last item which should be attached.
     */
    fill: function (start, end) {
      console.log(">fill this.items=" + this.items_.length);
      this.firstAttachedItem_ = Math.max(0, start);
      this.lastAttachedItem_ = end;
      console.log(">fill2 this.items=" + this.items_.length + "; this.firstAttachedItem_=" + JSON.stringify(this.firstAttachedItem_)
        + ";  this.lastAttachedItem_=" + JSON.stringify(this.lastAttachedItem_));

      this.maybeRequestContent(); //by me
      this.attachContent();
    },
    /**
     * Attaches content to the scroller and updates the scroll position if
     * necessary.
     */
    attachContent: function () {
      console.log(">attachContent this.items=" + this.items_.length + "; this.firstAttachedItem_=" + this.firstAttachedItem_ + "; this.lastAttachedItem_=" + this.lastAttachedItem_);
      // Collect nodes which will no longer be rendered for reuse.
      // TODO: Limit this based on the change in visible items rather than looping
      // over all items.
      var i;
      var unusedNodes = [];
      for (i = 0; i < this.items_.length; i++) {
        // Skip the items which should be visible.
        if (i == this.firstAttachedItem_) {
          i = this.lastAttachedItem_ - 1;
          continue;
        }
        if (this.items_[i].node) {
          // if (this.items_[i].node.classList.contains('tombstone')) {
          //  
          //   this.tombstones_.push(this.items_[i].node);
          //   this.tombstones_[this.tombstones_.length - 1].classList.add('invisible');
          // } else {
          unusedNodes.push(this.items_[i].node);
          // }
        }
        this.items_[i].node = null;
      }

      var tombstoneAnimations = {};
      // Create DOM nodes.
      console.log(">attachContent1 this.firstAttachedItem_=" + this.firstAttachedItem_ + "; this.lastAttachedItem_=" + this.lastAttachedItem_);
      for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
        // while (this.items_.length <= i){
        //    this.addItem_(); throw "XXXX";
        // }

        if (this.items_[i].node) {
          // // if it's a tombstone but we have data, replace it.
          // if (this.items_[i].node.classList.contains('tombstone') && this.items_[i].data) {
          //   // // TODO: Probably best to move items on top of tombstones and fade them in instead.
          //   // throw "XXXX";
          //   // this.items_[i].node.classList.add('invisible');
          //   // this.tombstones_.push(this.items_[i].node);

          //   // this.items_[i].node = null;
          // } else {
          continue;
          // }
        }
        // var node = this.items_[i].data ? this.source_.render(this.items_[i].data, unusedNodes.pop()) : this.getTombstone();
        console.log(">attachContent2 this.items=" + this.items_.length);
        var node = this.source_.render(this.items_[i].data, unusedNodes.pop());

        // Maybe don't do this if it's already attached?
        node.style.position = 'absolute';
        this.items_[i].top = -1;
        this.scroller_.appendChild(node);
        this.items_[i].node = node;
      }

      // Remove all unused nodes
      while (unusedNodes.length) {
        this.scroller_.removeChild(unusedNodes.pop());
      }
      // Leave it, required for collapsed expanded rows
      // Get the height of all nodes which haven't been measured yet.
      for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
        // Only cache the height if we have the real contents, not a placeholder.
        if (this.items_[i].data && !this.items_[i].height) {
          this.items_[i].height = this.items_[i].node.offsetHeight;
          this.items_[i].width = this.items_[i].node.offsetWidth;
        }
      }

      // Fix scroll position in case we have realized the heights of elements
      // that we didn't used to know.
      // TODO: We should only need to do this when a height of an item becomes
      // known above.
      this.anchorScrollTop = 0;
      for (i = 0; i < this.anchorItem.index; i++) {
        this.anchorScrollTop += this.items_[i].height || this.tombstoneSize_;
      }
      this.anchorScrollTop += this.anchorItem.offset;

      // Position all nodes.
      var curPos = this.anchorScrollTop - this.anchorItem.offset;
      i = this.anchorItem.index;
      while (i > this.firstAttachedItem_) {
        curPos -= this.items_[i - 1].height || this.tombstoneSize_;
        i--;
      }
      while (i < this.firstAttachedItem_) {
        curPos += this.items_[i].height || this.tombstoneSize_;
        i++;
      }
      // Set up initial positions for animations.
      // for (var i in tombstoneAnimations) {
      //   throw "XXXX";
      //   var anim = tombstoneAnimations[i];
      //   this.items_[i].node.style.transform = 'translateY(' + (this.anchorScrollTop + anim[1]) + 'px) scale(' + (this.tombstoneWidth_ / this.items_[i].width) + ', ' + (this.tombstoneSize_ / this.items_[i].height) + ')';
      //   // Call offsetTop on the nodes to be animated to force them to apply current transforms.
      //   this.items_[i].node.offsetTop;
      //   anim[0].offsetTop;
      //   this.items_[i].node.style.transition = 'transform ' + ANIMATION_DURATION_MS + 'ms';
      // }
      for (i = this.firstAttachedItem_; i < this.lastAttachedItem_; i++) {
        var anim = tombstoneAnimations[i];
        // if (anim) {
        //   anim[0].style.transition = 'transform ' + ANIMATION_DURATION_MS + 'ms, opacity ' + ANIMATION_DURATION_MS + 'ms';
        //   anim[0].style.transform = 'translateY(' + curPos + 'px) scale(' + (this.items_[i].width / this.tombstoneWidth_) + ', ' + (this.items_[i].height / this.tombstoneSize_) + ')';
        //   anim[0].style.opacity = 0;
        // }

        if (curPos != this.items_[i].top) {
          // if (!anim)
          //   this.items_[i].node.style.transition = '';
          this.items_[i].node.style.transform = 'translateY(' + curPos + 'px)';
        }
        this.items_[i].top = curPos;
        curPos += this.items_[i].height || this.tombstoneSize_;
      }

      this.scrollRunwayEnd_ = Math.max(this.scrollRunwayEnd_, curPos + SCROLL_RUNWAY)
      this.scrollRunway_.style.transform = 'translate(0, ' + this.scrollRunwayEnd_ + 'px)';
      this.scroller_.scrollTop = this.anchorScrollTop;
      this.maybeRequestContent();
    },

    /**
     * Requests additional content if we don't have enough currently.
     */
    maybeRequestContent: function () {
      var itemsNeeded = this.lastAttachedItem_ - this.loadedItems_;
      if (itemsNeeded <= 0)
        return;
      this.addContent(this.source_.fetch(itemsNeeded));
    },

    /**
     * Adds an item to the items list.
     */
    addItem_: function () {
      console.log(">addItem_ this.items=" + this.items_.length);
      this.items_.push({
        'data': null,
        'node': null,
        'height': 0,
        'width': 0,
        'top': 0,
      })
    },

    /**
     * Adds the given array of items to the items list and then calls
     * attachContent to update the displayed content.
     * @param {Array<Object>} items The array of items to be added to the infinite
     *     scroller list.
     */
    addContent: function (items) {
      for (var i = 0; i < items.length; i++) {
        if (this.items_.length <= this.loadedItems_)
          this.addItem_();
        this.items_[this.loadedItems_++].data = items[i];
      }
      this.attachContent();
    }
  }
})(self);
