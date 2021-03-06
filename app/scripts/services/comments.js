'use strict';

/**
* AngularJS Service for managing article comments.
*
* @class comments
*/
angular.module('authoringEnvironmentApp').service('comments', [
    'article',
    '$http',
    '$q',
    '$resource',
    'transform',
    'pageTracker',
    '$log',
    'nestedSort',
    function comments(
        articleService, $http, $q, $resource, transform, pageTracker,
        $log, nestedSort
    ) {
        /* max number of comments per page, decrease it in order to
         * test pagination, and sorting change with paginated
         * comments */
        var article = articleService.articleInstance,
            itemsPerPage = 50,
            self = this,  // alias for the comments service itself
            sorting = 'nested';

        /**
        * A flag indicating whether there are more comments to be loaded.
        * @property canLoadMore
        * @type Boolean
        * @default true
        */
        self.canLoadMore = true;

        /**
        * A list of all comments loaded so far.
        * @property loaded
        * @type Array
        * @default []
        */
        self.loaded = [];

        /**
        * A list of currently displayed comments.
        * @property displayed
        * @type Array
        * @default []
        */
        self.displayed = [];

        /**
        * Helper service for tracking which comments pages have been loaded.
        * @property tracker
        * @type Object (instance of pageTracker)
        */
        self.tracker = pageTracker.getTracker();

        /**
        * Helper object for communication with the backend API.
        * @property tracker
        * @type Object (as created by Angular's $resource factory)
        */
        self.resource = $resource(
            Routing.generate(
                'newscoop_gimme_comments_getcommentsforarticle_1', {}, true
            ) + '/:articleNumber/:languageCode',
            {},
            {
                create: {
                    method: 'POST',
                    transformRequest: transform.formEncode
                },
                patch: {
                    method: 'PATCH',
                    url: Routing.generate(
                            'newscoop_gimme_comments_updatecomment_1', {}, true
                        ) + '/:articleNumber/:languageCode/:commentId',
                    transformRequest: transform.formEncode
                },
                save: {
                    method: 'POST',
                    url: Routing.generate(
                        'newscoop_gimme_comments_createcomment', {}, true
                        ) + '/:articleNumber/:languageCode/:commentId',
                    transformRequest: transform.formEncode
                },
                delete: {
                    method: 'DELETE',
                    url: Routing.generate(
                        'newscoop_gimme_comments_deletecomment_1', {}, true
                        ) + '/:articleNumber/:languageCode/:commentId'
                },
                toggleRecommended: {
                    method: 'PATCH',
                    url: Routing.generate(
                        'newscoop_gimme_comments_updatecomment', {}, true
                        ) + '/:commentId.json'
                }
            }
        );

        /**
        * Asynchronously adds a new comment and displays it after it has been
        * successfully stored on the server.
        *
        * @method add
        * @param par {Object} A wrapper around the object containing
        *   comment data. As such it can be directly passed to the relevant
        *   method of self.resource object.
        *   @param par.comment {Object} The actual object with comment data.
        *     @param par.comment.subject {String} Comment's subject
        *     @param par.comment.message {String} Comment's body
        *     @param [par.comment.parent] {Number} ID of the parent comment
        * @return {Object} A promise object
        */
        self.add = function (par) {
            var deferred = $q.defer();

            self.resource.create({
                articleNumber: article.articleId,
                languageCode: article.language
            }, par, function (data, headers) {
                var url = headers('X-Location');
                if (url) {
                    $http.get(url).success(function (data) {
                        // just add the new comment to the end and filters
                        // will take care of the correct ordering
                        self.displayed.push(decorate(data));
                        nestedSort.sort(self.displayed);
                    });
                } else {
                    // the header may not be available if the server
                    // is on a different domain (we are in this
                    // situation at the beginning of dev) and it is
                    // not esplicitely enabled
                    // http://stackoverflow.com/a/18178524/393758
                    self.init();
                }
                deferred.resolve();
            });

            return deferred.promise;
        };

        /**
        * Initializes all internal variables to their default values, then
        * loads and displays the first batch of article comments.
        *
        * @method init
        */
        self.init = function (opt) {
            // XXX: from user experience perspective current behavior might
            // not be ideal (to reload everything, e.g. after adding a new
            // comment), but for now we stick with it as a reasonable
            // compromise between UX and complexity of the logic in code
            self.tracker = pageTracker.getTracker();
            self.canLoadMore = true;
            self.loaded = [];
            self.displayed = [];
            if (opt && opt.sorting) {
                sorting = opt.sorting;
            } else {
                sorting = 'nested';
            }
            self.load(self.tracker.next()).then(function (data) {
                self.displayed = data.items.map(decorate);
                nestedSort.sort(self.displayed);
                if (self.canLoadMore) {
                    // prepare the next batch
                    self.load(self.tracker.next()).then(function (data) {
                        self.loaded = self.loaded.concat(data.items);
                    });
                }
            });
        };

        /**
        * If there are more comments to be loaded from the server, the method
        * first takes one page of comments from the pre-loaded comments list
        * and appends them to the end of the displayed comments list. After
        * that it also asynchronously loads the next page of comments from
        * the server.
        *
        * @method more
        */
        self.more = function () {
            if (self.canLoadMore) {
                var additional = self.loaded.splice(0, itemsPerPage);
                additional = additional.map(decorate);
                self.displayed = self.displayed.concat(additional);
                var next = self.tracker.next();
                self.load(next).then(function (data) {
                    self.loaded = self.loaded.concat(data.items);
                });
            } else {
                $log.error(
                    'More comments required, but the service cannot ' +
                    'load more of them. In this case the user should not ' +
                    'be able to trigger this request'
                );
            }
        };

        /**
        * Asynchronously loads a single page of article comments.
        *
        * @method load
        * @param page {Number} Index of the page to load
        *     (NOTE: page indices start with 1)
        * @return {Object} A promise object
        */
        self.load = function (page) {
            var deferred = $q.defer(),
                sortingPart,
                url;

            if (sorting === 'nested') {
                sortingPart = 'nested';
            } else {
                sortingPart = '';
            }

            url = Routing.generate(
                'newscoop_gimme_comments_getcommentsforarticle_1',
                {
                    number: article.articleId,
                    language: article.language,
                    order: sortingPart,
                    items_per_page: itemsPerPage,
                    page: page
                },
                true
            );

            $http.get(url).success(function (data) {
                deferred.resolve(data);
                if (pageTracker.isLastPage(data.pagination)) {
                    self.canLoadMore = false;
                }
            }).error(function () {
                // in case of failure remove the page from the tracker
                self.tracker.remove(page);
            });

            return deferred.promise;
        };
        /**
        * Creates and returns a comparison function. This functions accepts an
        * object with the "id" attribute as a parameter and returns true if
        * object.id is equal to the value of the "id" parameter passed to
        * the method. If not, the created comparison function returns false.
        *
        * The returned comparison function can be used, for instance, as a
        * parameter to various utility functions - one example would be
        * a function, which filters given array based on some criteria.
        *
        * @method matchMaker
        * @param id {Number} Value to which the object.id will be compared in
        *   the comparison function (can also be a numeric string).
        *   NOTE: before comparison the parameter is converted to integer
        *   using the built-in parseInt() function.
        *
        * @return {Function} Generated comparison function.
        */
        self.matchMaker = function (id) {
            return function (needle) {
                return parseInt(needle.id) === parseInt(id);
            };
        };

        /**
        * Changes the 'selected' status of the selected comments (if commentId
        * is not given) or of a specific comment (if commentId is given).
        * If `deep` is set to true, affected comments' subcomments' statuses
        * are changed, too.
        *
        * @method changeSelectedStatus
        * @param status {String} the new status to be set
        * @param deep {Boolean} whether or not to change the statuses of
        *     affected comments' subcomments as well
        * @param [commentId] {Number} ID of a specific comment to change
        *     status for
        */
        self.changeSelectedStatus = function (status, deep, commentId) {
            var comment = null,
                displayed = self.displayed, // just an alias
                i = 0,
                len = displayed.length,
                toChange = [];  // list of comments for which to change status

            if (!deep && typeof commentId !== 'undefined') {
                // a specific comment
                displayed.forEach(function (item) {
                    if (item.id === commentId) {
                        item.changeStatus(status);
                    }
                });
                return;
            }

            if (!deep && typeof commentId === 'undefined') {
                // all selected comments
                displayed.forEach(function (item) {
                    if (item.selected) {
                        item.changeStatus(status);
                    }
                });
                return;
            }

            if (deep && typeof commentId !== 'undefined') {
                // a specific comment and all of its subcomments
                while (i < len) {
                    if (comment) {
                        // comment with a commentId has already been found
                        if (displayed[i].thread_level > comment.thread_level) {
                            toChange.push(displayed[i]);
                        } else {
                            break;  // no more subcomments
                        }
                    } else if (displayed[i].id === commentId) {
                        comment = displayed[i];
                        toChange.push(comment);
                    }
                    i++;
                }
            } else {  // deep && typeof commentId === 'undefined'
                // selected comments and all of their subcomments
                while (i < len) {
                    if (comment) {
                        // a selected comment has been found
                        if (displayed[i].thread_level > comment.thread_level) {
                            toChange.push(displayed[i]);
                        } else {
                            // end of comment's sublevels
                            comment = null;
                            continue;  // NOTE: i is not incremented here!
                        }
                    } else if (displayed[i].selected) {
                        comment = displayed[i];
                        toChange.push(comment);
                    }
                    i++;
                }
            }

            toChange.forEach(function (comment) {
                comment.changeStatus(status);
            });
        };

        /**
        * Decorates an object containing raw comment data (as returned by
        * the API) with properties and methods, turning it into a
        * self-contained "comment entity", which knows how to manage itself
        * (e.g. editing, saving, removing...)
        *
        * @class decorate
        * @param comment {Object} Object containing comment's (meta)data
        * @return {Object} Decorated comment object
        */
        function decorate(comment) {
            /**
            * @class comment
            */

            /**
            * Reflects the checkbox on the left of every comment
            * @property selected
            * @type Boolean
            * @default false
            */
            comment.selected = false;

            /**
            * How the comment is currently displayed (collapsed or expanded).
            * @property showStatus
            * @type String
            * @default "collapsed"
            */
            comment.showStatus = 'collapsed';

            /**
            * A flag indicating whether the comment is currently being edited.
            * @property isEdited
            * @type Boolean
            * @default false
            */
            comment.isEdited = false;

            /**
            * A flag indicating whether the comment is marked as
            * recommended or not.
            * @property recommended
            * @type Boolean
            */
            comment.recommended = !!comment.recommended;  // to Boolean

            /**
            * An object holding comment properties yet to be saved on
            *   the server
            * @property editing
            */
            comment.editing = {status: comment.status};

            /**
            * Object holding a subject and a message of the new reply to
            * the comment.
            *
            * @property reply
            * @type Object
            * @default {subject: 'Re: <comment-subject>', message: ''}
            */
            comment.reply = {
                subject: 'Re: ' + comment.subject,
                message: ''
            };

            /**
            * A flag indicating whether or not a reply-to-comment mode is
            * currently active.
            *
            * @property isReplyMode
            * @type Boolean
            * @default false
            */
            comment.isReplyMode = false;

            /**
            * A flag indicating whether or not a reply is currently being
            * sent to the server.
            *
            * @property sendingReply
            * @type Boolean
            * @default false
            */
            comment.sendingReply = false;

            /**
            * Sets comment's display status to collapsed.
            * @method collapse
            */
            comment.collapse = function () {
                this.showStatus = 'collapsed';
                this.isReplyMode = false;
            };

            /**
            * Sets comment's display status to expanded.
            * @method expand
            */
            comment.expand = function () {
                this.showStatus = 'expanded';
            };

            /**
            * Changes comment's display status from expanded to collapsed or
            * vice versa.
            * @method toggle
            */
            comment.toggle = function () {
                if ('expanded' === this.showStatus) {
                    this.collapse();
                } else {
                    this.expand();
                }
            };

            /**
            * Puts comment into edit mode.
            * @method edit
            */
            comment.edit = function () {
                this.editing.subject = this.subject;
                this.editing.message = this.message;
                this.isEdited = true;
                this.isReplyMode = false;
            };

            /**
            * End comment's edit mode.
            * @method cancel
            */
            comment.cancel = function () {
                this.isEdited = false;
            };

            /**
            * Asynchronously saves/updates the comment and ends the edit mode.
            * @method save
            */
            comment.save = function () {
                var comment = this,
                    deferred = $q.defer();

                self.resource.save({
                    articleNumber: article.articleId,
                    languageCode: article.language,
                    commentId: comment.id
                }, { comment: comment.editing }, function () {
                    deferred.resolve();
                    comment.subject = comment.editing.subject;
                    comment.message = comment.editing.message;
                    comment.isEdited = false;
                }, function () {
                    deferred.reject();
                });

                return deferred.promise;
            };

            /**
            * Asynchronously deletes the comment.
            * @method remove
            */
            comment.remove = function () {
                var comment = this;

                self.resource.delete({
                    articleNumber: article.articleId,
                    languageCode: article.language,
                    commentId: comment.id
                }).$promise.then(function () {
                    _.remove(
                        self.displayed,
                        self.matchMaker(comment.id)
                    );
                });
            };

            /**
            * Enters into reply-to-comment mode.
            * @method replyTo
            */
            comment.replyTo = function () {
                comment.isReplyMode = true;
            };

            /**
            * Exits from reply-to-comment mode.
            * @method cancelReply
            */
            comment.cancelReply = function () {
                comment.isReplyMode = false;
            };

            /**
            * Asynchronously adds a new reply to the comment and displays it
            * after successfully storing it on the server.
            * @method sendReply
            */
            comment.sendReply = function () {
                var comment = this,
                    deferred = $q.defer(),
                    // alias for the comment object itself
                    replyData = angular.copy(comment.reply);
                replyData.parent = comment.id;
                comment.sendingReply = true;
                self.add({ 'comment': replyData }).then(function () {
                    deferred.resolve();
                    comment.sendingReply = false;
                    comment.isReplyMode = false;
                    comment.reply = {
                        subject: 'Re: ' + comment.subject,
                        message: ''
                    };
                }, function () {
                    deferred.reject();
                });

                return deferred.promise;
            };

            /**
            * Asynchronously toggle the comment between being and not-being
            * marked as recommended.
            * @method toggleRecommended
            */
            comment.toggleRecommended = function () {
                var comment = this, newStatus = !comment.recommended;
                self.resource.toggleRecommended(
                    {commentId: comment.id},
                    {comment: {recommended: newStatus ? 1 : 0 }},
                    function () {
                        comment.recommended = newStatus;
                    }
                );
            };

            /**
            * Ask to the server to change the status, rollback if it fails
            * @method changeStatus
            */
            comment.changeStatus = function (newStatus) {
                var comment = this;

                self.resource.patch({
                    articleNumber: article.articleId,
                    languageCode: article.language,
                    commentId: comment.id
                }, { comment: { status: newStatus } }, function () {
                    // success
                    comment.status = newStatus;
                }, function () {
                    // failure
                    $log.debug(
                        'error changing the status for the comment');
                });
            };

            return comment;
        }
    }
]);
