MyApp = new Backbone.Marionette.Application();

//Region corresponds to area used in application
MyApp.addRegions({
  //Region is set by passing jQuery selector we want to use
  mainRegion: "#content"
});

//Creating a model for a drink
Drink = Backbone.Model.extend({
  /* No longer needed because model's rank is set within initializer.
  defaults: {
  //Specifies a default value for the model's "rank" attribute
    rank: 0
  }
  */

  //Vote incrementer in model
  defaults: {
    votes: 0
  },

  addVote: function(){
    this.set('votes', this.get('votes') + 1);
  },

  //Implements swapping functionality for ranks
  rankUp: function() {
    this.set({rank: this.get('rank') - 1});
  },

  rankDown: function() {
    this.set({rank: this.get('rank') + 1});
  }
});

//In order to create multiple drinks, we need to create a collection
Drinks = Backbone.Collection.extend({
  //Object is not empty because it needs to know kind of model it contains
  model: Drink,

  //Sets proper rank when creating a collection
  initialize: function(drinks){
    var rank = 1;
    _.each(drinks, function(drink) {
      drink.rank = rank;
      ++rank;
    });

    //Error handler and listens to collection's "add" event
    this.on('add', function(drink){
      if( ! drink.get('rank') ){
        var error =  Error("Drink must have a rank defined before being added to the collection");
        error.name = "NoRankError";
        throw error;
      }
    });

    var self = this;

    //Listens for messages from published events in ItemView
    //Helps implement swap functionality
    MyApp.on("rank:up", function(drink){
      if (drink.get('rank') === 1) {
        // can't increase rank of top-ranked drink
        return true;
      }
      self.rankUp(drink);
      self.sort();
    });

    MyApp.on("rank:down", function(drink){
      if (drink.get('rank') === self.size()) {
        // can't decrease rank of lowest ranked drink
        return true;
      }
      self.rankDown(drink);
      self.sort();
    });

    //When drink is removed, goes through each drink ranked below it and reduces rank by 1
    MyApp.on("drink:disqualify", function(drink){
      var disqualifiedRank = drink.get('rank');
      var drinksToUprank = self.filter(
        function(drink){ return drink.get('rank') > disqualifiedRank; }
      );
      drinksToUprank.forEach(function(drink){
        drink.rankUp();
      });
      //Resets collection to let app know collection changed
      self.trigger('reset');
    });
  },

  //Sorts the collection according to rank
  comparator: function(drink) {
    return drink.get('rank');
  },

  //Helps with swap functionality
  rankUp: function(drink) {
    // find the drink we're going to swap ranks with
    var rankToSwap = drink.get('rank') - 1;
    var otherDrink = this.at(rankToSwap - 1);

    // swap ranks
    drink.rankUp();
    otherDrink.rankDown();
  },

  rankDown: function(drink) {
    // find the drink we're going to swap ranks with
    var rankToSwap = drink.get('rank') + 1;
    var otherDrink = this.at(rankToSwap - 1);

    // swap ranks
    drink.rankDown();
    otherDrink.rankUp();
  }
});

//Don't have to declare a render method because Backbone.Marionette takes care of it for us
//ItemView represents a single item
DrinkView = Backbone.Marionette.ItemView.extend({
  template: "#drink-template",
  tagName: 'tr',
  className: 'drink',

  //Captures and defines events linked to buttons
  events: {
    'click .rank_up img': 'rankUp',
    'click .rank_down img': 'rankDown',
    //Click to remove a drink from rankings
    'click a.disqualify': 'disqualify'
  },

  //Rerenders ItemView each time "votes" attribute in model changes
  initialize: function(){
    this.listenTo(this.model, "change:votes", this.render);
  },

  //Publishes an event instead of printing to browser console
  rankUp: function(){
    //Adds vote to model each time a vote button is clicked in ItemView
    this.model.addVote();
    MyApp.trigger("rank:up", this.model);
  },

  rankDown: function(){
    //Adds vote to model each time a vote button is clicked in ItemView
    this.model.addVote();
    MyApp.trigger("rank:down", this.model);
  },

  //Removes drinks from rankings
  disqualify: function(){
    //Fixes rankings when drink is removed
    MyApp.trigger("drink:disqualify", this.model);
    this.model.destroy();
  }
});

//Renders the collection without having to update view when collection changes
DrinksView = Backbone.Marionette.CompositeView.extend({
  tagName: "table",
  id: "drinks",
  className: "table-stripled table bordered",
  template: "#drinks-template",
  //Tells which ItemView to use to render each model within collection
  itemView: DrinkView,

  //Need the view to rerender the portion displaying the collection when the latter is sorted
  initialize: function(){
    this.listenTo(this.collection, "sort", this.renderCollection);
  },

  appendHtml: function(collectionView, itemView) {
    collectionView.$("tbody").append(itemView.el);
  }
});

//Receives options we send to our app when we call its "start"
//Basically, creates a new view with drinks and display them
MyApp.addInitializer(function(options){
  var drinksView = new DrinksView({
    collection: options.drinks
  });
  MyApp.mainRegion.show(drinksView);
});

//Once DOM is ready, create collection of drinks populated by drink models we create
$(document).ready(function(){
  var drinks = new Drinks([
    new Drink({ name: 'Whisky', image_path: 'assets/images/Whisky.jpg' }),
    new Drink({ name: 'AMF', image_path: 'assets/images/AMF.jpg' }),
    new Drink({ name: 'Mojito', image_path: 'assets/images/Mojito.jpg' })
  ]);

  MyApp.start({drinks: drinks});

  //Adding new drinks to the collection after it has been rendered
  drinks.add(new Drink({
    name: 'Beer',
    image_path: 'assets/images/Beer.jpg',
    rank: drinks.size() + 1
  }));
  drinks.add(new Drink({
    name: 'Mai-Tai',
    image_path: 'assets/images/MaiTai.jpg',
    rank: drinks.size() + 1
  }));
});
