'use strict';

describe('Controller: PaneSnippetsCtrl', function () {

    // load the controller's module
    beforeEach(module('authoringEnvironmentApp'));

    var article,
        articleDeferred,
        Snippet,
        SnippetTemplate,
        SnippetsCtrl,
        scope,
        $q;

    // Initialize the controller and a mock scope
    beforeEach(inject(
        function (
            $controller, $rootScope, _$q_, _article_, _Snippet_,
            _SnippetTemplate_
        ) {
            $q = _$q_;
            article = _article_;
            Snippet = _Snippet_;
            SnippetTemplate = _SnippetTemplate_;

            articleDeferred = $q.defer();
            article.promise = articleDeferred.promise;

            spyOn(Snippet, 'getAllByArticle').andCallFake(function () {
                return [{id:1}, {id:2}];
            });

            spyOn(SnippetTemplate, 'getAll').andCallFake(function () {
                return [
                    {id:10, name: 'YouTube'},
                    {id:20, name: 'Vimeo'},
                    {id:30, name: 'FB Like'}
                ];
            });

            scope = $rootScope.$new();
            SnippetsCtrl = $controller('PaneSnippetsCtrl', {
                $scope: scope,
                article: article,
                Snippet: Snippet,
                SnippetTemplate: SnippetTemplate
            });
        }
    ));

    it('initializes scope\'s showAddSnippet flag to false', function () {
        expect(scope.showAddSnippet).toBe(false);
    });

    it('initializes newSnippet object in scope', function () {
        expect(scope.newSnippet).toEqual({name: '', template: null});
    });

    it('initializes scope\'s addingNewSnippet flag to false', function () {
        expect(scope.addingNewSnippet).toBe(false);
    });

    it('initializes (template field type --> HTML input type) ' +
       'mapping in scope',
        function () {
            // NOTE: must use a "frozen" version, otherwise built-in comparison
            // fails (probably due to different data descriptors of object's
            // properties)
            var expected = Object.freeze({
                integer: 'number',
                text: 'text',
                url: 'url'
            });
            expect(scope.inputFieldTypes).toEqual(expected);
        }
    );

    it('initializes a list of snippet templates in scope', function () {
        expect(SnippetTemplate.getAll).toHaveBeenCalled();
        expect(scope.snippetTemplates).toEqual([
            {id:10, name: 'YouTube'},
            {id:20, name: 'Vimeo'},
            {id:30, name: 'FB Like'}
        ]);
    });

    it('initializes a list of article snippets in scope', function () {
        articleDeferred.resolve({number: 55, language: 'pl'});
        scope.$apply();
        expect(Snippet.getAllByArticle).toHaveBeenCalledWith(55, 'pl');
        expect(scope.snippets).toEqual([{id:1}, {id:2}]);
    });

    describe('scope\'s clearNewSnippetForm() method', function () {
        it('clears all new snippet form fields (deep)', function () {
            scope.snippetTemplates = [
                {
                    id:10,
                    name: 'YouTube',
                    fields: [
                        {name: 'field_1', value: 'foobar'},
                        {name: 'field_2', value: 'barbaz'}
                    ]
                },
                {
                    id:30,
                    name: 'FB Like',
                    fields: [ {name: 'counter', value: 42} ]
                }
            ];

            scope.newSnippet = {
                name: 'YouTube',
                template: {id: 5, code: '<foo>'}
            };

            scope.clearNewSnippetForm();

            expect(scope.newSnippet).toEqual({name: '', template: null});
            expect(scope.snippetTemplates).toEqual([
                {
                    id:10, name: 'YouTube',
                        fields: [
                            {name: 'field_1'}, {name: 'field_2'}
                        ]
                },
                {
                    id:30, name: 'FB Like', fields: [{name: 'counter'}]
                }
            ]);
        });
    });

    describe('scope\'s addNewSnippetToArticle() method', function () {
        var createdSnippet,
            deferredAdd,
            deferredCreate,
            snippetData;

        beforeEach(inject(function ($q) {
            snippetData = {
                name: 'my video',
                template: {
                    id: 8,
                    fields: [{
                        name: 'public_link',
                        value: 'http://foo.bar/video.avi',
                        type: 'url'
                    }]
                }
            };

            deferredCreate = $q.defer();
            spyOn(Snippet, 'create').andCallFake(function () {
                return deferredCreate.promise;
            });

            deferredAdd = $q.defer();
            createdSnippet = {
                id: 42,
                addToArticle: function () {
                    return deferredAdd.promise
                }
            };
        }));

        it('sets addingNewSnippet flag before doing anything', function () {
            scope.addingNewSnippet = false;
            scope.addNewSnippetToArticle(snippetData);
            expect(scope.addingNewSnippet).toBe(true);
        });

        it('clears addingNewSnippet flag on successful server response',
            function () {
                scope.addNewSnippetToArticle(snippetData);
                scope.addingNewSnippet = true;

                deferredCreate.resolve(createdSnippet);
                articleDeferred.resolve({number: 25, language: 'de'});
                deferredAdd.resolve();
                scope.$apply();

                expect(scope.addingNewSnippet).toBe(false);
            }
        );

        it('clears addingNewSnippet flag on error server response',
            function () {
                scope.addNewSnippetToArticle(snippetData);
                scope.addingNewSnippet = true;

                deferredCreate.reject();
                scope.$apply();

                expect(scope.addingNewSnippet).toBe(false);
            }
        );

        it('calls snippet factory method with correct parameters',
            function () {
                scope.addNewSnippetToArticle(snippetData);
                expect(Snippet.create).toHaveBeenCalledWith(
                    'my video', 8, {'public_link': 'http://foo.bar/video.avi'}
                );
            }
        );

        it('attaches created snippet to article', function () {
            spyOn(createdSnippet, 'addToArticle').andCallThrough();

            scope.addNewSnippetToArticle(snippetData);
            deferredCreate.resolve(createdSnippet);
            articleDeferred.resolve({number: 25, language: 'de'});
            scope.$apply();

            expect(createdSnippet.addToArticle).toHaveBeenCalledWith(25, 'de');
        });

        it('appends new snippet to scope\'s snippets list', function () {
            scope.addNewSnippetToArticle(snippetData);
            deferredCreate.resolve(createdSnippet);
            articleDeferred.resolve({number: 25, language: 'de'});
            deferredAdd.resolve();
            scope.$apply();

            expect(scope.snippets).toEqual([{id: 1}, {id: 2}, createdSnippet]);
        });
    });


    describe('scope\'s confirmRemoveSnippet() method', function () {
        var snippet,
            snippetRemoveDeferred,
            modalDeferred,
            modalFactory;

        beforeEach(inject(function ($q, _modalFactory_) {
            snippetRemoveDeferred = $q.defer();
            modalDeferred = $q.defer();
            modalFactory = _modalFactory_;

            spyOn(modalFactory, 'confirmLight').andCallFake(function () {
                return {
                    result: modalDeferred.promise
                }
            });

            snippet = {
                id: 42,
                removeFromArticle: jasmine.createSpy().andCallFake(
                    function () {
                        return snippetRemoveDeferred.promise;
                    })
            };
        }));

        it('opens a "light" confirmation dialog', function () {
            scope.confirmRemoveSnippet();
            expect(modalFactory.confirmLight).toHaveBeenCalled();
        });

        it('removes correct snippet on action confirmation', function () {
            articleDeferred.resolve({number: 25, language: 'de'});
            scope.$apply();

            scope.snippets = [{id:123}, snippet, {id:321}];

            scope.confirmRemoveSnippet(snippet);
            modalDeferred.resolve(true);
            scope.$apply();

            expect(snippet.removeFromArticle).toHaveBeenCalledWith(25, 'de');

            snippetRemoveDeferred.resolve();
            scope.$apply();

            expect(scope.snippets).toEqual(
                [{id:123}, {id:321}]
            );
        });

        it('does not remove anything on action cancellation', function () {
            articleDeferred.resolve({number: 25, language: 'de'});
            scope.$apply();

            scope.snippets = [{id:123}, snippet, {id:321}];

            scope.confirmRemoveSnippet(snippet);
            modalDeferred.reject(true);
            scope.$apply();

            expect(snippet.removeFromArticle).not.toHaveBeenCalled();
            expect(scope.snippets.length).toEqual(3);
        });

        it('does not remove snippet on server error response', function () {
            articleDeferred.resolve({number: 25, language: 'de'});
            scope.$apply();

            scope.snippets = [{id:123}, snippet, {id:321}];

            scope.confirmRemoveSnippet(snippet);
            modalDeferred.resolve(true);
            snippetRemoveDeferred.reject();
            scope.$apply();

            expect(scope.snippets.length).toEqual(3);
        });
    });
});