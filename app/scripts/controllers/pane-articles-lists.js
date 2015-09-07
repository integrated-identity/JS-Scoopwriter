'use strict';

/**
* AngularJS controller for the ArticlesLists pane.
*
* @class PaneArticlesListsCtrl
*/
angular.module('authoringEnvironmentApp').controller('PaneArticlesListsCtrl', [
    '$q',
    '$scope',
    'article',
    'modalFactory',
    'ArticlesList',
    'toaster',
    'TranslationService',
    function (
        $q,
        $scope,
        articleService,
        modalFactory,
        ArticlesList,
        toaster,
        TranslationService) {
        var article = articleService.articleInstance,
            // all existing articlesLists to choose from
            availableArticlesLists = [],
            // avilableArticlesLists initialized yet?
            articlesListListRetrieved = false;

        $scope.selectedArticlesLists = [];
        // articlesList assignment in progress?
        $scope.assigningArticlesLists = false;

        $scope.select2Options = {
            minimumInputLength: 3,
            query: ArticlesList.liveSearchQuery
        };

        $scope.newArticlesList = {
            title: ''
        };

        // retrieve all articlesLists assigned to the article
        $scope.assignedArticlesLists = ArticlesList.getAllByArticle(
            article.articleId, article.language
        );

        /**
        * Resets all new articlesList form fields and validation errors.
        *
        * @method clearNewArticlesListForm
        */
        $scope.clearNewArticlesListForm = function () {
            $scope.newArticlesList.title = '';
            $scope.newArticlesList.parentArticlesList = null;
            $scope.addArticlesList.articlesListTitle
                .$setValidity('duplicate', true);
        };

        /**
        * Clears the list of currently selected articlesLists.
        *
        * @method clearSelectedArticlesLists
        */
        $scope.clearSelectedArticlesLists = function () {
            while ($scope.selectedArticlesLists.length > 0) {
                $scope.selectedArticlesLists.pop();
            }
        };

        /**
        * Finds a list of articlesLists that can be assigned to 
        * the article based on the search query. ArticlesLists that
        * are already selected or assigned to
        * the article are excluded from search results.
        *
        * @method findArticlesLists
        * @param query {String} articlesLists search query
        * @return {Object} promise object which is resolved with (filtered)
        *   search results
        */
        $scope.findArticlesLists = function (query) {
            var deferred = $q.defer(),
                ignored = {},
                filtered;

            // build a list of articlesList IDs to exclude from results 
            // (i.e. articlesLists that are already selected and/or
            // assigned to the article)
            $scope.selectedArticlesLists.forEach(function (item) {
                ignored[item.id] = true;
            });
            $scope.assignedArticlesLists.forEach(function (item) {
                ignored[item.id] = true;
            });

            // articlesLists list is long, thus we only retrieve it once
            if (!articlesListListRetrieved) {
                availableArticlesLists = ArticlesList.getAll(article.language);
            }

            availableArticlesLists.$promise.then(function () {
                articlesListListRetrieved = true;
                query = query.toLowerCase();

                filtered = _.filter(availableArticlesLists, function (item) {
                    return (
                        !(item.id in ignored) &&
                        item.title.toLowerCase().indexOf(query) >= 0
                    );
                });

                deferred.resolve(filtered);
            });

            return deferred.promise;
        };

        /**
        * Assigns all currently selected articlesLists to the article and
        * then clears the selected articlesLists list.
        *
        * @method assignSelectedToArticle
        */
        $scope.assignSelectedToArticle = function () {
            $scope.assigningArticlesLists = true;

            ArticlesList.addToArticle(
                article.articleId,
                article.language,
                $scope.selectedArticlesLists
            ).then(function (articlesLists) {
                articlesLists.forEach(function (item) {
                    $scope.assignedArticlesLists.push(item);
                });
                $scope.clearSelectedArticlesLists();
                toaster.add({
                    type: 'sf-info',
                    message: TranslationService.trans(
                        'aes.msgs.articleslists.assign.success'
                    )
                });
            }, function () {
                toaster.add({
                    type: 'sf-error',
                    message: TranslationService.trans(
                        'aes.msgs.articleslists.assign.error'
                    )
                });
            }).finally(function () {
                $scope.assigningArticlesLists = false;
            });

            // XXX: what about errors, e.g. 409 Conflict?
        };

        /**
        * Asks user to confirm unassigning a articlesList from the article
        * then unassignes the articlesList, if the action is confirmed.
        *
        * @method confirmUnassignArticlesList
        * @param articlesList {Object} articlesList to unassign
        */
        $scope.confirmUnassignArticlesList = function (articlesList) {
            var modal,
                title,
                text;

            title = TranslationService.trans(
                'aes.msgs.articleslists.unassign.popupHead'
            );
            text = TranslationService.trans(
                'aes.msgs.articleslists.unassign.popup'
            );

            modal = modalFactory.confirmLight(title, text);

            modal.result.then(function () {
                return articlesList.removeFromArticle(
                    article.articleId,
                    article.language,
                    articlesList).then(function () {
                        _.remove(
                            $scope.assignedArticlesLists,
                            {id: articlesList.id}
                        );
                        toaster.add({
                            type: 'sf-info',
                            message: TranslationService.trans(
                                'aes.msgs.articleslists.unassign.success'
                            )
                        });
                    }, function () {
                        toaster.add({
                            type: 'sf-error',
                            message: TranslationService.trans(
                                'aes.msgs.articleslists.unassign.error'
                            )
                        });
                    });
            }, $q.reject);
        };
    }
]);
